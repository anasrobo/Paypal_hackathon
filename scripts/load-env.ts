/**
 * Load the local environment for a standalone script.
 *
 * Next.js loads `.env.local` itself, so this is only for the scripts that
 * run outside the framework: the migration runner, the seed and the
 * rehearsal.
 *
 * `process.loadEnvFile` does NOT override variables that are already set, so
 * a real environment variable always wins over the file. That is the
 * behaviour a deployment needs.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

export function loadLocalEnv(): void {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  try {
    process.loadEnvFile(path);
  } catch {
    // A malformed file is not fatal here. The script will fail later with a
    // clear message about the variable it actually needed.
  }
}
