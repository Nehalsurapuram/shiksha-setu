import { checkDatabase } from "@/lib/database/queries";

/**
 * The only API route in Phase 1.
 *
 * It exists so a deployment can be checked without opening a browser, and it
 * deliberately reports nothing sensitive: no connection string, no key value,
 * only whether the database answered.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const database = await checkDatabase();

  return Response.json(
    {
      status: database.ok ? "ok" : "degraded",
      phase: 1,
      database: database.ok ? "connected" : "unreachable",
      checkedAt: new Date().toISOString(),
    },
    { status: database.ok ? 200 : 503 },
  );
}
