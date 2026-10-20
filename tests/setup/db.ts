/**
 * The test database.
 *
 * The integration tests need a REAL Postgres, because the money-safety
 * invariants are database constraints: UNIQUE(bounty_id), the status
 * trigger, the insert-first payout row. A mock would prove nothing.
 *
 * The Vitest global setup boots the embedded Postgres, applies the
 * migrations, and publishes TEST_DATABASE_URL. This module connects to it.
 */

import postgres from "postgres";
import { DB_OPTIONS } from "@/server/db/client";

export type TestSql = postgres.Sql;

let client: TestSql | null = null;

export function testDb(): TestSql {
  if (client) return client;
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. The Vitest global setup should have set it.",
    );
  }
  client = postgres(url, DB_OPTIONS);
  return client;
}

export async function closeTestDb(): Promise<void> {
  if (!client) return;
  await client.end({ timeout: 5 });
  client = null;
}

/**
 * Remove every row this test suite created, without touching the schema.
 *
 * The table names are SCHEMA-QUALIFIED, so a truncate can never reach a
 * same-named table in another schema. The tests run against the embedded
 * Postgres, but a qualified name means that even a misconfigured run cannot
 * truncate a table it does not own.
 */
export async function truncateAll(sql: TestSql): Promise<void> {
  const schema = process.env.APP_DB_SCHEMA ?? "public";
  await sql.unsafe(`
    TRUNCATE "${schema}".bounty_events, "${schema}".verification_checks,
             "${schema}".webhook_events, "${schema}".payouts,
             "${schema}".evidence, "${schema}".bounties
    RESTART IDENTITY CASCADE
  `);
}
