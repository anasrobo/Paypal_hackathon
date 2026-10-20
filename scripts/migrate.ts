/**
 * Apply the migrations.
 *
 *   npm run db:migrate            apply pending migrations
 *   npm run db:migrate -- --reset drop the schema first, then apply
 *
 * The connection comes from DATABASE_URL. In production that is the Supabase
 * pooler host; locally it is the embedded Postgres started by
 * `npm run db:local`.
 */

import { closeDb, db } from "../src/server/db/client";
import { resetSchema, runMigrations } from "../src/server/db/migrate";

async function main(): Promise<void> {
  const sql = db();

  if (process.argv.includes("--reset")) {
    console.log("resetting schema");
    await resetSchema(sql);
  }

  console.log("applying migrations");
  const results = await runMigrations(sql, (m) => console.log(m));

  const applied = results.filter((r) => r.status === "applied").length;
  const skipped = results.length - applied;
  console.log(`done — ${applied} applied, ${skipped} already current`);

  await closeDb();
}

main().catch(async (error) => {
  console.error("migration failed:", error instanceof Error ? error.message : error);
  await closeDb().catch(() => {});
  process.exit(1);
});
