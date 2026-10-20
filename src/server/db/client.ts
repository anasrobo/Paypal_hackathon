/**
 * The database client.
 *
 * This is the ONLY module that may create a database connection, and the only
 * one that may read DATABASE_URL. Everything else imports `db()` from here.
 *
 * Why one pool and not several: on a pooled Postgres, every client is a
 * pool of its own, and the total is what the database has to serve. The
 * user's own production project states the rule — "keep using the shared
 * engine, do not create new engines per module" — and it is why a separate
 * Supabase project exists for this app in the first place.
 *
 * Why pooler only: the direct Supabase host is IPv6-only. A Vercel function
 * cannot connect to it. `getEnv()` refuses to start in production without a
 * pooler host, so this cannot ship broken.
 */

import postgres from "postgres";
import { getEnv } from "../env";

export type Sql = postgres.Sql;

/**
 * The connection options, shared by the application, the scripts and the
 * test setup, so every caller sees the same row shape.
 *
 * `transform: postgres.camel` maps snake_case columns to camelCase keys, so
 * `store_name` arrives as `storeName` without an alias on every query.
 */
export const DB_OPTIONS = {
  // Two connections per function instance. The pooler multiplexes many
  // instances onto a small number of backend connections.
  max: 2,
  // Recycle connections so a long-lived function does not hold stale ones.
  idle_timeout: 10,
  max_lifetime: 60,
  // Fail fast rather than hang. A judge waiting 30 seconds for a timeout
  // is worse than an instant error.
  connect_timeout: 5,
  // Required for transaction-mode poolers.
  prepare: false,
  connection: { application_name: "groundtruth" },
  onnotice: () => {},
  transform: postgres.camel,
} as const;

let client: Sql | null = null;

export function db(): Sql {
  if (client) return client;

  const env = getEnv();

  client = postgres(env.DATABASE_URL, DB_OPTIONS);

  return client;
}

/**
 * Run `fn` inside a transaction.
 *
 * postgres.js `begin()` gives a real transaction with a dedicated
 * connection, which is what the payout insert needs. It works through the
 * transaction-mode pooler, which an interactive ORM transaction often does
 * not.
 */
export async function withTransaction<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return db().begin(async (tx) => fn(tx)) as Promise<T>;
}

/** Close the pool. Used by scripts and tests so the process can exit. */
export async function closeDb(): Promise<void> {
  if (!client) return;
  await client.end({ timeout: 5 });
  client = null;
}

/** Cheap liveness check. The health endpoint uses this. */
export async function ping(): Promise<boolean> {
  try {
    await db()`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
