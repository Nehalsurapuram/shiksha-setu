import { randomUUID } from "node:crypto";

import { z } from "zod";

import { FlashcardDeckSchema } from "@/lib/ai/generated-content";
import { fail } from "@/lib/api/speech-responses";
import { prisma } from "@/lib/database/prisma";
import { isDenied, requireApiUser } from "@/lib/auth/guards";
import {
  getDefaultLanguagePair,
} from "@/lib/database/queries";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  grade: z.number().int().min(1).max(12).nullable().default(null),
  subject: z.string().trim().max(120).nullable().default(null),
  deck: FlashcardDeckSchema,
  provider: z.string().trim().max(40).nullable().default(null),
  model: z.string().trim().max(80).nullable().default(null),
  isEdited: z.boolean().default(false),
});

/**
 * POST /api/flashcards
 *
 * Saves a whole deck. Cards share a generated `deckId` so the set can be
 * reopened as the set it was, rather than being matched by title later.
 *
 * `languageId` is the mother tongue: a card's identity is the language it
 * teaches, and `backText` is that language's word — even when it is empty
 * because the term was left untranslated on purpose.
 */
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail("PROVIDER_ERROR", "Could not read the request.", 400);
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return fail("PROVIDER_ERROR", "The deck is missing required fields.", 400);
  }

  const authorized = await requireApiUser();
  if (isDenied(authorized)) return authorized.response;

  const teacher = authorized.user;
  const pair = await getDefaultLanguagePair();

  if (!teacher) {
    return fail(
      "PROVIDER_ERROR",
      "No teacher account is set up on this installation.",
      503,
    );
  }
  if (!pair) return fail("PROVIDER_ERROR", "No language pair is configured.", 503);

  const input = parsed.data;
  const deckId = randomUUID();

  try {
    await prisma.flashcard.createMany({
      data: input.deck.cards.map((card) => ({
        frontText: card.term,
        backText: card.termSat ?? "",
        icon: card.icon,
        exampleSentence: card.exampleSentence,
        deckId,
        deckTitle: input.deck.title,
        grade: input.grade,
        subject: input.subject,
        provider: input.provider,
        model: input.model,
        isEdited: input.isEdited,
        languageId: pair.target.id,
        createdById: teacher.id,
      })),
    });

    return Response.json({
      success: true,
      deckId,
      title: input.deck.title,
      cardCount: input.deck.cards.length,
    });
  } catch (error) {
    console.error("[flashcards] create", error);
    return fail("PROVIDER_ERROR", "Could not save the deck. Try again.", 500);
  }
}
