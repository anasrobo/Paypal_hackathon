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

import { rmSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";
import { DB_OPTIONS } from "../../src/server/db/client";
import { runMigrations } from "../../src/server/db/migrate";

const PORT = Number(process.env.GT_LOCAL_PG_PORT ?? 55432);
const DATABASE = "groundtruth_test";
const USER = "postgres";
const PASSWORD = "postgres";

let pg: EmbeddedPostgres | undefined;

/**
 * The data directory for this run.
 *
 * A previous run may have left the directory behind — especially if the
 * server had to be force-killed — and initdb refuses a non-empty directory.
 * So the directory is removed first. On Windows a file can still be locked
 * for a moment after the process dies, so if the removal fails the run falls
 * back to a fresh directory instead of failing the whole suite.
 */
function freshDataDir(): string {
  const base = "./.tmp/pgdata";
  try {
    rmSync(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    return base;
  } catch {
    const fallback = `./.tmp/pgdata-${Date.now()}`;
    // Best effort: the stale directory is garbage, but it must never stop a
    // test run.
    try {
      rmSync(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    } catch {
      // ignored
    }
    return fallback;
  }
}

export async function setup(): Promise<void> {
  // SAFETY: the integration tests TRUNCATE tables. They must NEVER run
  // against a shared or production database by accident. The embedded
  // Postgres is used unless an external database is explicitly opted into
  // with GT_USE_EXTERNAL_DB=1.
  const allowExternal = process.env.GT_USE_EXTERNAL_DB === "1";
  const external = allowExternal ? process.env.TEST_DATABASE_URL : undefined;

  if (external) {
    // An externally provided database (CI's service container, or a real
    // Supabase project). The services read DATABASE_URL, so it has to point
    // at the same database as the tests.
    process.env.TEST_DATABASE_URL = external;
    process.env.DATABASE_URL = external;
    return;
  }

  const dataDir = freshDataDir();

  pg = new EmbeddedPostgres({
    databaseDir: dataDir,
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
    const instance = pg;
    pg = undefined;
    // On Windows the embedded server sometimes does not acknowledge the stop
    // in time. A leftover postgres process holds the shared-memory block, and
    // the NEXT run then fails with "pre-existing shared memory block is still
    // in use". So the stop is bounded, and then it is forced.
    const stopped = await Promise.race([
      instance.stop().then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    if (!stopped) {
      console.warn("[setup] the embedded postgres did not stop in time — forcing it");
      await forceStopPostgres();
    }
  }
}

/** Kill every postgres process this machine is running for the test suite. */
async function forceStopPostgres(): Promise<void> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  try {
    if (process.platform === "win32") {
      await run("taskkill", ["/F", "/IM", "postgres.exe"]);
    } else {
      await run("pkill", ["-f", "embedded-postgres"]);
    }
  } catch {
    // Nothing to kill, or the kill failed. The next run cleans up anyway.
  }
}
