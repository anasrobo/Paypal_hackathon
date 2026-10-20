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

import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
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
 * A UNIQUE directory, every time. A previous run may have left a directory
 * behind — especially if the server had to be force-killed — and initdb
 * refuses a non-empty directory. On Windows the old directory can also stay
 * LOCKED for a while after the process dies, so removing it is not
 * reliable. A unique name cannot collide and cannot be locked.
 *
 * The stale directories are garbage, but they are cleaned up eventually:
 * anything older than two hours is removed at the start of the next run.
 */
function freshDataDir(): string {
  const dir = `./.tmp/pgdata-${process.pid}-${Date.now()}`;

  try {
    if (existsSync("./.tmp")) {
      const cutoff = Date.now() - 2 * 60 * 60 * 1000;
      for (const entry of readdirSync("./.tmp")) {
        if (!entry.startsWith("pgdata")) continue;
        const full = `./.tmp/${entry}`;
        try {
          if (statSync(full).mtimeMs < cutoff) {
            rmSync(full, { recursive: true, force: true, maxRetries: 2, retryDelay: 200 });
          }
        } catch {
          // A locked directory is not a reason to fail a test run.
        }
      }
    }
  } catch {
    // Best effort.
  }

  return dir;
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
    // `persistent: true` is load-bearing on Windows. With `persistent: false`
    // the library deletes the data directory IMMEDIATELY after `taskkill`,
    // before Windows has released the handles — which fails with EBUSY and
    // takes the whole test run down with it. The directory is unique per run
    // anyway, and `freshDataDir` removes the stale ones.
    persistent: true,
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
    await stopServer();
    pg = undefined;
    throw error;
  }
}

export async function teardown(): Promise<void> {
  if (pg) {
    const instance = pg;
    pg = undefined;
    await stopServer(instance);
  }
}

/**
 * Stop the embedded server, and never let it take the test run with it.
 *
 * The library's `stop()` is a generator that can throw, and on Windows the
 * teardown races the operating system's handle release. The stop is therefore
 * bounded, and then it is forced.
 */
async function stopServer(instance?: EmbeddedPostgres): Promise<void> {
  const target = instance ?? pg;
  if (!target) return;

  const stopped = await Promise.race([
    Promise.resolve(target.stop()).then(
      () => true,
      () => true,
    ),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);

  if (!stopped) {
    console.warn("[setup] the embedded postgres did not stop in time — forcing it");
    await forceStopPostgres();
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
