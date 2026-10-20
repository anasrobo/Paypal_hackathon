#!/usr/bin/env node
// Guards the .gitignore.
//
// The upstream repo shipped GitHub's Python template, whose bare `lib/`,
// `build/`, `dist/`, `cover/`, `instance/`, `env/`, `ENV/`, `var/`, `parts/`,
// `wheels/` and `eggs/` patterns match at ANY depth. Git cannot re-include
// files under an excluded directory, so a bare `lib/` silently untracked an
// entire source tree: green local build, missing files in the repo, broken
// judge clone.
//
// This script asserts both directions with `git check-ignore`:
//   MUST NOT be ignored  -> source and config that has to reach the repo
//   MUST be ignored      -> dependencies, build output and secrets
import { execFileSync } from "node:child_process";

const MUST_NOT_IGNORE = [
  "src/lib/x.ts",
  "src/domain/gate.ts",
  "src/domain/state-machine.ts",
  "src/server/db/client.ts",
  "src/app/api/health/route.ts",
  ".env.example",
  "docs/DEMO.md",
  "docs/BUILD_STATE.md",
  "db/migrations/001_init.sql",
  "package.json",
  "package-lock.json",
  "README.md",
  "LICENSE",
  "AGENTS.md",
];

const MUST_IGNORE = [
  "node_modules/x",
  ".next/x",
  ".vercel/x",
  ".env",
  ".env.local",
  ".env.production.local",
  "coverage/x",
  "playwright-report/x",
  "test-results/x",
  "foo.bak",
  "secret.pem",
  "secret.key",
];

function isIgnored(path) {
  try {
    execFileSync("git", ["check-ignore", "-q", "--", path], { stdio: "ignore" });
    return true;
  } catch (err) {
    // exit 0 => ignored. 1 => not ignored. anything else is a real error.
    if (err && typeof err.status === "number" && err.status === 1) return false;
    throw err;
  }
}

const failures = [];

for (const p of MUST_NOT_IGNORE) {
  if (isIgnored(p)) failures.push(`must be TRACKED but is ignored: ${p}`);
}
for (const p of MUST_IGNORE) {
  if (!isIgnored(p)) failures.push(`must be IGNORED but is tracked: ${p}`);
}

if (failures.length > 0) {
  console.error("check:ignore FAILED");
  for (const f of failures) console.error(`  - ${f}`);
  console.error("\nIf a source path is being ignored, git cannot re-include it");
  console.error("under an excluded directory. Fix .gitignore, and remember that");
  console.error("this project must never use a directory named `lib/` (D-004).");
  process.exit(1);
}

console.log(
  `check:ignore OK (${MUST_NOT_IGNORE.length} tracked, ${MUST_IGNORE.length} ignored)`,
);
