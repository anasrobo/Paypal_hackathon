/**
 * The migration runner.
 *
 * Numbered, append-only, plain SQL — the same convention the user's own
 * production project uses. The difference is that this one is TRACKED: the
 * applied versions are recorded in `schema_migrations`, so re-running is a
 * no-op and a partial apply is visible.
 *
 * The Supabase CLI is not installed on this machine and Docker is not
 * available, so this is the only way migrations are applied. It is also the
 * way CI applies them, which keeps local and CI identical.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Sql } from "./client";
import { getEnv } from "../env";

export const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

export interface MigrationResult {
  version: string;
  file: string;
  status: "applied" | "skipped";
}

export async function runMigrations(
  sql: Sql,
  log: (message: string) => void = () => {},
): Promise<MigrationResult[]> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      name       text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const rows = await sql<{ version: string }[]>`SELECT version FROM schema_migrations`;
  const applied = new Set(rows.map((r) => r.version));

  const results: MigrationResult[] = [];

  for (const file of files) {
    const version = file.split("_")[0];
    if (!version) throw new Error(`migration file has no version prefix: ${file}`);

    if (applied.has(version)) {
      log(`  skip    ${file}`);
      results.push({ version, file, status: "skipped" });
      continue;
    }

    const text = readFileSync(join(MIGRATIONS_DIR, file), "utf8");

    // `unsafe` without parameters uses the simple query protocol, which
    // supports a multi-statement file including the $$ function bodies.
    await sql.unsafe(text);

    await sql`
      INSERT INTO schema_migrations (version, name)
      VALUES (${version}, ${file})
      ON CONFLICT (version) DO NOTHING
    `;

    log(`  applied ${file}`);
    results.push({ version, file, status: "applied" });
  }

  return results;
}

/**
 * Drop everything this app owns, and nothing else.
 *
 * It drops the application's OWN schema — never `public`. In the shared
 * Supabase project, `public` holds the live product's tables, and dropping
 * it would be catastrophic. The schema name comes from APP_DB_SCHEMA, and it
 * is validated as a plain identifier so it can never be interpolated into
 * something dangerous.
 */
export async function resetSchema(sql: Sql): Promise<void> {
  const schema = getEnv().APP_DB_SCHEMA;
  await sql.unsafe(`
    DROP SCHEMA IF EXISTS "${schema}" CASCADE;
    CREATE SCHEMA "${schema}";
  `);
}
