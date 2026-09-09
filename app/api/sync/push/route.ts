import { z } from "zod";

import { fail } from "@/lib/api/speech-responses";
import { MAX_INPUT_CHARS } from "@/lib/ai/translation-provider";
import { prisma } from "@/lib/database/prisma";
import { isDenied, requireApiUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

const ItemSchema = z.object({
  id: z.string().min(1),
  entityType: z.literal("TranslationCorrection"),
  entityId: z.string().min(1),
  operation: z.enum(["CREATE", "UPDATE", "DELETE"]),
  payload: z.object({
    correctedText: z.string().trim().min(1).max(MAX_INPUT_CHARS * 2),
    reason: z.string().trim().max(500).nullable(),
  }),
  /** The row version this edit was made against. */
  baseUpdatedAt: z.string().min(1),
  createdAt: z.string().min(1),
  /** Set by the teacher after seeing a conflict: apply on top of the newer row. */
  force: z.boolean().optional(),
});

const PushSchema = z.object({
  deviceId: z.string().min(1),
  // A tablet that has been offline for a week still sends one request.
  items: z.array(ItemSchema).min(1).max(200),
});

type ItemResult = {
  id: string;
  status: "SYNCED" | "CONFLICT" | "FAILED";
  message?: string;
  /** Present on a conflict, so the teacher can compare before deciding. */
  server?: { text: string; updatedAt: string };
  /** Present on success: the device advances its base to this. */
  applied?: { updatedAt: string; correctedText: string };
};

/**
 * POST /api/sync/push — drains a tablet's queue of offline changes.
 *
 * The rule this endpoint exists to enforce: **a change made against an old
 * version of a row never silently overwrites a newer one.** Each item carries
 * the `updatedAt` it was edited against; if the server's row has moved on since
 * — another teacher corrected it, or the same teacher on another tablet — the
 * item comes back as CONFLICT with the server's current text, and nothing is
 * written. The teacher decides, and only then does a `force` item apply.
 *
 * Items are handled one at a time and reported one at a time. A batch is not a
 * transaction: one conflicted correction must not block the other nineteen
 * that are perfectly applicable, and a teacher who has been offline for a week
 * should not lose a whole day's work to a single clash.
 */
export async function POST(request: Request) {
  const authorized = await requireApiUser();
  if (isDenied(authorized)) return authorized.response;
  const teacher = authorized.user;
  if (!teacher) {
    return fail(
      "PROVIDER_ERROR",
      "No teacher account is set up on this installation.",
      503,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("BAD_REQUEST", "Send a JSON body.", 400);
  }

  const parsed = PushSchema.safeParse(body);
  if (!parsed.success) {
    return fail("BAD_REQUEST", "The sync payload was not in the expected shape.", 400);
  }

  const { deviceId, items } = parsed.data;
  const results: ItemResult[] = [];

  for (const item of items) {
    try {
      results.push(await applyItem(item, deviceId, teacher.id));
    } catch (error) {
      console.error("[sync/push]", error);
      results.push({
        id: item.id,
        status: "FAILED",
        message: "The server could not apply this change. It stays queued.",
      });
    }
  }

  return Response.json({
    success: true,
    syncedAt: new Date().toISOString(),
    results,
  });
}

async function applyItem(
  item: z.infer<typeof ItemSchema>,
  deviceId: string,
  userId: string,
): Promise<ItemResult> {
  const translation = await prisma.translation.findUnique({
    where: { id: item.entityId },
    select: {
      id: true,
      targetText: true,
      updatedAt: true,
      corrections: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { correctedText: true },
      },
    },
  });

  if (!translation) {
    await recordSyncItem(item, deviceId, userId, "FAILED", "Translation no longer exists.");
    return {
      id: item.id,
      status: "FAILED",
      message:
        "That translation no longer exists on the server, so this correction cannot be applied.",
    };
  }

  const serverText = translation.corrections[0]?.correctedText ?? translation.targetText;
  const serverUpdatedAt = translation.updatedAt.toISOString();

  // Millisecond comparison of ISO strings, not equality: clocks on tablets
  // drift, and a stale base is what matters, not an exact match.
  const movedOn =
    translation.updatedAt.getTime() > new Date(item.baseUpdatedAt).getTime();

  if (movedOn && !item.force) {
    await recordSyncItem(
      item,
      deviceId,
      userId,
      "CONFLICT",
      "Server row changed after this edit was made.",
    );
    return {
      id: item.id,
      status: "CONFLICT",
      server: { text: serverText, updatedAt: serverUpdatedAt },
      message:
        "This translation was corrected somewhere else after you edited it. Nothing was overwritten.",
    };
  }

  if (serverText.trim() === item.payload.correctedText.trim()) {
    // Someone already made exactly this change — most often this tablet, on a
    // retry after a reply was lost. Reporting success is honest: the server
    // holds what the teacher asked for.
    await recordSyncItem(item, deviceId, userId, "SYNCED", null);
    return {
      id: item.id,
      status: "SYNCED",
      applied: { updatedAt: serverUpdatedAt, correctedText: serverText },
      message: "Already saved on the server.",
    };
  }

  const [, updated] = await prisma.$transaction([
    prisma.translationCorrection.create({
      data: {
        translationId: translation.id,
        correctedById: userId,
        correctedText: item.payload.correctedText,
        reason: item.payload.reason,
        // What the model produced, kept with the correction. Same as the online
        // path — an offline correction is not a lesser record, and it goes to
        // an expert for verification exactly like one typed at a desk.
        aiTranslation: translation.targetText,
        isAccepted: true,
      },
    }),
    prisma.translation.update({
      where: { id: translation.id },
      data: { reviewStatus: "CORRECTED" },
      select: { updatedAt: true },
    }),
  ]);

  await recordSyncItem(item, deviceId, userId, "SYNCED", null);

  return {
    id: item.id,
    status: "SYNCED",
    applied: {
      updatedAt: updated.updatedAt.toISOString(),
      correctedText: item.payload.correctedText,
    },
  };
}

/**
 * Records what the tablet sent, whatever came of it.
 *
 * Keyed on the queue's own natural key, so a retry after a lost reply updates
 * the existing row instead of writing the same change twice. The table is the
 * server-side account of a device's queue: what arrived, what applied, and what
 * clashed.
 */
async function recordSyncItem(
  item: z.infer<typeof ItemSchema>,
  deviceId: string,
  userId: string,
  status: "SYNCED" | "CONFLICT" | "FAILED",
  lastError: string | null,
) {
  const clientTime = new Date(item.createdAt);
  const key = {
    deviceId_entityType_entityId_clientTime: {
      deviceId,
      entityType: item.entityType,
      entityId: item.entityId,
      clientTime,
    },
  };

  const common = {
    operation: item.operation,
    status,
    payload: item.payload,
    lastError,
    syncedAt: status === "SYNCED" ? new Date() : null,
  };

  await prisma.syncItem.upsert({
    where: key,
    create: {
      deviceId,
      entityType: item.entityType,
      entityId: item.entityId,
      clientTime,
      userId,
      attempts: 1,
      ...common,
    },
    update: { attempts: { increment: 1 }, ...common },
  });
}
