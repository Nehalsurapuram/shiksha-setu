import { z } from "zod";

import { isDenied, requireApiUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/database/prisma";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  id: z.string().min(1),
  isVerified: z.boolean(),
});

/**
 * GET /api/admin/glossary — every term, verified or not.
 * PATCH /api/admin/glossary — withdraw or restore a term's verified mark.
 *
 * Administrative and not a teacher's: `isVerified` is the strongest claim this
 * product makes about a piece of language. Withdrawing one is how a mistake
 * that reached the glossary gets taken back out of every future translation.
 */
export async function GET() {
  const authorized = await requireApiUser("administer");
  if (isDenied(authorized)) return authorized.response;

  const terms = await prisma.glossaryTerm.findMany({
    orderBy: [{ isVerified: "desc" }, { updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      sourceTerm: true,
      targetTerm: true,
      domain: true,
      isVerified: true,
      sourceCorrectionId: true,
      updatedAt: true,
    },
  });

  return Response.json({ success: true, terms });
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
        error: { code: "BAD_REQUEST", message: "Give a term id and a verified flag." },
      },
      { status: 400 },
    );
  }

  const term = await prisma.glossaryTerm.update({
    where: { id: parsed.data.id },
    data: { isVerified: parsed.data.isVerified },
    select: { id: true, sourceTerm: true, isVerified: true },
  });

  return Response.json({ success: true, term });
}
