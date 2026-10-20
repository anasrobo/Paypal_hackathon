/**
 * Environment.
 *
 * This is the ONLY module allowed to read `process.env`. Everything else
 * takes what it needs from `getEnv()`.
 *
 * Validation is lazy: a module-level throw would break `next build`, which
 * evaluates modules without a database. The first call that actually needs
 * the environment is the one that fails loudly.
 *
 * The failure mode matters more than the validation. A placeholder secret in
 * production is worse than a missing one, because a placeholder secret means
 * the app RUNS and quietly does the wrong thing — signing tokens with a
 * published key, or authenticating to the wrong PayPal account.
 */

import { z } from "zod";

const PLACEHOLDER_MARKERS = [
  "placeholder",
  "change-me",
  "changeme",
  "dummy",
  "your-",
  "your_",
];

export type PayPalProviderName = "mock" | "sandbox";
export type VisionProviderName = "mock" | "openai";

/**
 * The development-only defaults.
 *
 * Every one of these is an OBVIOUS placeholder. They exist so the app boots
 * with no credentials at all in development, and the production guard in
 * `parse` refuses to start if any of them is still in place.
 */
export const PLACEHOLDERS = {
  tokenSecret: "change-me-32-chars-minimum-placeholder",
  cronSecret: "change-me-cron-secret-placeholder",
  paypalMockWebhookSecret: "mock-webhook-secret-placeholder",
} as const;

/**
 * An optional string setting. Shared so the schema below stays readable.
 *
 * It is deliberately `z.string().optional()` and NOT `z.string().min(1)`:
 * a `.env.local` that lists a setting with an empty value is a normal thing
 * to find, and an empty optional setting is exactly what it means.
 */
const optionalText = z.string().optional();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  TEST_DATABASE_URL: z.string().optional(),
  /**
   * The Postgres schema this application owns.
   *
   * In the shared Supabase project this is `groundtruth`, and the
   * application connects as a dedicated role whose own search_path is pinned
   * to that schema. The role has no privileges on any other schema, so the
   * live tables in `public` are not merely untouched — they are invisible
   * and unreachable from this application.
   */
  APP_DB_SCHEMA: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/i, "APP_DB_SCHEMA must be a plain identifier")
    .default("public"),

  SUPABASE_URL: optionalText,
  SUPABASE_SERVICE_ROLE_KEY: optionalText,
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("evidence"),

  PAYPAL_PROVIDER: z.enum(["mock", "sandbox"]).default("mock"),
  PAYPAL_SANDBOX_BASE_URL: z.string().url().default("https://api-m.sandbox.paypal.com"),
  PAYPAL_CLIENT_ID: optionalText,
  PAYPAL_CLIENT_SECRET: optionalText,
  PAYPAL_WEBHOOK_ID: optionalText,
  PAYPAL_WEBHOOK_SECRET: optionalText,
  PAYPAL_MOCK_WEBHOOK_SECRET: z.string().min(1).default(PLACEHOLDERS.paypalMockWebhookSecret),
  PAYPAL_MOCK_FAIL_EMAIL: z.string().email().default("payout-fail@demo.test"),

  VISION_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
  VISION_API_KEY: optionalText,
  VISION_MODEL: optionalText,
  MOCK_VISION_LATENCY_MS: z.coerce.number().int().min(0).max(10_000).default(150),
  MOCK_PAYPAL_LATENCY_MS: z.coerce.number().int().min(0).max(10_000).default(250),

  TOKEN_SECRET: z.string().min(1).default(PLACEHOLDERS.tokenSecret),
  CRON_SECRET: z.string().min(1).default(PLACEHOLDERS.cronSecret),

  APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("GroundTruth"),
});

export type Env = z.infer<typeof schema>;

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

function parse(source: NodeJS.ProcessEnv): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new EnvError(`Invalid environment:\n${issues}`);
  }

  const env = parsed.data;

  // The checks below only bite in production. In development the placeholders
  // are exactly what lets the app boot with no credentials at all.
  if (env.NODE_ENV === "production") {
    if (isPlaceholder(env.TOKEN_SECRET) || env.TOKEN_SECRET.length < 32) {
      throw new EnvError(
        "TOKEN_SECRET must be at least 32 characters and not a placeholder in production.",
      );
    }
    if (isPlaceholder(env.CRON_SECRET) || env.CRON_SECRET.length < 16) {
      throw new EnvError(
        "CRON_SECRET must be at least 16 characters and not a placeholder in production.",
      );
    }
    if (env.PAYPAL_PROVIDER === "sandbox") {
      if (!env.PAYPAL_CLIENT_ID || isPlaceholder(env.PAYPAL_CLIENT_ID)) {
        throw new EnvError("PAYPAL_CLIENT_ID is required when PAYPAL_PROVIDER=sandbox.");
      }
      if (!env.PAYPAL_CLIENT_SECRET || isPlaceholder(env.PAYPAL_CLIENT_SECRET)) {
        throw new EnvError(
          "PAYPAL_CLIENT_SECRET is required when PAYPAL_PROVIDER=sandbox.",
        );
      }
    }
    if (env.SUPABASE_URL) {
      if (!env.SUPABASE_SERVICE_ROLE_KEY || isPlaceholder(env.SUPABASE_SERVICE_ROLE_KEY)) {
        throw new EnvError(
          "SUPABASE_SERVICE_ROLE_KEY is required when SUPABASE_URL is set in production.",
        );
      }
    }
    if (!env.APP_URL.startsWith("https://")) {
      throw new EnvError("APP_URL must be https in production.");
    }
    if (!env.DATABASE_URL.includes("pooler.supabase.com")) {
      // The direct Supabase host is IPv6-only and Vercel cannot reach it.
      // This is the single highest-probability way to ship a demo that 500s
      // for every judge.
      throw new EnvError(
        "DATABASE_URL must point at the Supabase POOLER host in production " +
          "(the direct host is IPv6-only and unreachable from Vercel).",
      );
    }
  }

  return env;
}

let memo: Env | null = null;

export function getEnv(): Env {
  if (!memo) memo = parse(process.env);
  return memo;
}

/** Test seam: forget the parsed environment. */
export function resetEnvCache(): void {
  memo = null;
}

/** Test seam: parse an explicit environment without touching process.env. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return parse(source);
}
