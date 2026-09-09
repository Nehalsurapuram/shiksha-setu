import type { Metadata } from "next";

import { RequiresConnection } from "@/components/offline/requires-connection";
import { PageHeader } from "@/components/shared/page-header";
import type { HistoryEntry } from "@/components/translator/translation-history";
import { TranslatorWorkspace } from "@/components/translator/translator-workspace";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/guards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TranslationService } from "@/lib/ai/TranslationService";
import {
  getDefaultLanguagePair,
  listTranslationHistory,
} from "@/lib/database/queries";

export const metadata: Metadata = { title: "Translator" };
export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export default async function TranslatorPage() {
  const [pair, teacher] = await Promise.all([
    getDefaultLanguagePair(),
    requireUser(),
  ]);

  if (!pair) {
    return (
      <>
        <PageHeader title="Translator" />
        <Card>
          <CardHeader>
            <CardTitle>No language pair is configured</CardTitle>
            <CardDescription>
              The Language table needs an active source and an active target
              language. Run the seed script to load Hindi and Santhali.
            </CardDescription>
          </CardHeader>
        </Card>
      </>
    );
  }

  const history = teacher ? await listTranslationHistory(teacher.id) : [];

  // Provider is resolved on the server; only its identity crosses to the
  // client, never the key.
  const service = new TranslationService();
  const isDemo = service.isDemo;

  const entries: HistoryEntry[] = history.map((row) => ({
    id: row.id,
    sourceText: row.sourceText,
    targetText: row.targetText,
    source: row.source,
    reviewStatus: row.reviewStatus,
    createdAtLabel: DATE_FORMAT.format(row.createdAt),
    sourceLanguageCode: row.sourceLanguage.code,
    targetLanguageCode: row.targetLanguage.code,
    targetIsOlChiki: row.targetLanguage.script === "OL_CHIKI",
    correctedText: row.corrections[0]?.correctedText ?? null,
  }));

  return (
    <>
      <PageHeader
        title={`${pair.source.name} → ${pair.target.name} Translator`}
        description="Translate lesson text into the mother tongue, then correct it. Corrections are kept so the same mistake does not have to be fixed twice."
        action={
          isDemo ? (
            <Badge variant="warning">Demo mode</Badge>
          ) : (
            <Badge variant="success">Sarvam connected</Badge>
          )
        }
      />

      <RequiresConnection
        feature="Translating new text"
        stillAvailable="Translations you have already made stay readable."
      />

      {isDemo ? (
        <Card className="mb-6 border-warning/50 bg-warning/10">
          <CardContent className="p-4 sm:p-5">
            <h2 className="font-semibold text-warning-foreground">
              Demo mode — no translation model is connected
            </h2>
            <p className="mt-1.5 text-sm text-warning-foreground">
              <code className="rounded bg-warning/20 px-1 py-0.5">
                SARVAM_API_KEY
              </code>{" "}
              is not set on this server, so the translator returns a placeholder
              notice instead of Santhali text. Nothing produced in this mode is
              a translation, and results are stored and labelled as demo so they
              can never be mistaken for one.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <TranslatorWorkspace
        sourceLanguage={{ code: pair.source.code, name: pair.source.name }}
        targetLanguage={{ code: pair.target.code, name: pair.target.name }}
        targetIsOlChiki={pair.target.script === "OL_CHIKI"}
        history={entries}
      />
    </>
  );
}
