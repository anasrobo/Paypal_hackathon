/**
 * Vitest global setup.
 *
 * Boots a real Postgres, applies the migrations, and publishes the
 * connection string as TEST_DATABASE_URL.
 *
 * A real database, not a mock, because the money-safety invariants ARE
 * database constraints: UNIQUE(bounty_id), the status trigger, the
 * insert-first payout row. Mocking them would prove nothing.
 *
 * Docker is not available on this machine, so the server is the embedded
 * Postgres binary shipped as a dev dependency. CI uses a postgres service
 * container instead, and both paths run the same migrations.
 */

import EmbeddedPostgres from "embedded-postgres";
import { DB_OPTIONS } from "../../src/server/db/client";
import { runMigrations } from "../../src/server/db/migrate";

const PORT = Number(process.env.GT_LOCAL_PG_PORT ?? 55432);
const DATABASE = "groundtruth_test";
const USER = "postgres";
const PASSWORD = "postgres";

let pg: EmbeddedPostgres | undefined;

export async function setup(): Promise<void> {
  const external = process.env.TEST_DATABASE_URL;

  if (external) {
    // An externally provided database (CI's service container, or a real
    // Supabase project). Use it as-is.
    process.env.TEST_DATABASE_URL = external;
    return;
  }

  pg = new EmbeddedPostgres({
    databaseDir: "./.tmp/pgdata",
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: false,
  });

  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase(DATABASE);

    const url = `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}`;
    process.env.TEST_DATABASE_URL = url;
    process.env.DATABASE_URL = url;

    const postgres = (await import("postgres")).default;
    const sql = postgres(url, DB_OPTIONS);
    try {
      await runMigrations(sql, (m) => console.log(`  [migrate] ${m}`));
    } finally {
      await sql.end({ timeout: 5 });
    }
  } catch (error) {
    // Vitest does not call teardown when setup throws, so the server would be
    // left running and the process would never exit. Stop it here.
    await pg.stop().catch(() => {});
    pg = undefined;
    throw error;
  }
}

export async function teardown(): Promise<void> {
  if (pg) {
    await pg.stop().catch(() => {});
    pg = undefined;
  }
}
