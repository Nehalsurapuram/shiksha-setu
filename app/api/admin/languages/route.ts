import { z } from "zod";

import { isDenied, requireApiUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/database/prisma";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  code: z.string().min(2).max(16),
  status: z.enum(["ACTIVE", "PLANNED", "DEPRECATED"]),
});

/**
 * GET /api/admin/languages — what the installation supports.
 * PATCH /api/admin/languages — enable or disable one.
 *
 * Administrative because switching a language on is a claim that this product
 * can teach in it. A teacher enabling Mundari because it appears in a dropdown
 * would put untested machine output in front of children in a language nobody
 * has checked.
 */
export async function GET() {
  const authorized = await requireApiUser("administer");
  if (isDenied(authorized)) return authorized.response;

  const languages = await prisma.language.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      nativeName: true,
      status: true,
      isSource: true,
      isTarget: true,
    },
  });

  return Response.json({ success: true, languages });
}

export async function PATCH(request: Request) {
  const authorized = await requireApiUser("administer");
  if (isDenied(authorized)) return authorized.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Send a JSON body." } },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "Give a language code and a status." },
      },
      { status: 400 },
    );
  }

  const language = await prisma.language.update({
    where: { code: parsed.data.code },
    data: { status: parsed.data.status },
    select: { code: true, name: true, status: true },
  });

  return Response.json({ success: true, language });
}
