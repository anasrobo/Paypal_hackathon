#!/usr/bin/env node
// Fails the build if a real secret is committed.
//
// Only TRACKED files are scanned — an untracked local .env.local is fine.
// `.env.example` is skipped because it is the committed template and is
// expected to contain assignment-shaped lines.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const SKIP_FILES = new Set([".env.example"]);
const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx", ".txt",
  ".sql", ".yml", ".yaml", ".toml", ".css", ".html", ".sh", ".ps1", ".env",
]);

// A secret-looking assignment whose value is not an obvious placeholder.
const ASSIGNMENT =
  /\b([A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|ACCESS_KEY|API_KEY|SERVICE_ROLE)[A-Z0-9_]*)\s*[:=]\s*["']?([^\s"',;]{16,})/g;

const PLACEHOLDER =
  /(placeholder|change-me|changeme|dummy|your[-_]|example|xxxx|\.{3,}|\*{3,}|\$[A-Z{]|<[^>]+>|^$)/i;

// The PEM patterns are assembled from fragments so that this scanner does not
// match its own source. A scanner that flags itself is a scanner nobody runs.
const PEM_BEGIN = "-----BEGIN ";
const PEM_END = "-----";

const HARD_FAILURES = [
  {
    pattern: new RegExp(PEM_BEGIN + "(?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY" + PEM_END),
    why: "private key block",
  },
  {
    pattern: new RegExp(PEM_BEGIN + "CERTIFICATE" + PEM_END),
    why: "certificate block",
  },
  { pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, why: "JWT" },
  { pattern: /\bsb_secret_[A-Za-z0-9]{20,}/, why: "Supabase service role key" },
  { pattern: /\bA[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{80,}/, why: "PayPal/Google API credential" },
];

let tracked = [];
try {
  tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
} catch {
  console.error("check:secrets FAILED — could not read the tracked file list");
  process.exit(1);
}

const findings = [];

for (const file of tracked) {
  if (SKIP_FILES.has(file)) continue;
  if (!TEXT_EXT.has(extname(file)) && !file.includes(".env")) continue;

  let stat;
  try {
    stat = statSync(file);
  } catch {
    continue;
  }
  if (stat.size > 2_000_000) continue;

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  text.split(/\r?\n/).forEach((line, i) => {
    for (const { pattern, why } of HARD_FAILURES) {
      if (pattern.test(line)) {
        findings.push(`${file}:${i + 1}  ${why}`);
      }
    }
    ASSIGNMENT.lastIndex = 0;
    let m;
    while ((m = ASSIGNMENT.exec(line)) !== null) {
      const [, name, value] = m;
      if (PLACEHOLDER.test(value)) continue;
      // A bare identifier reference such as process.env.FOO is not an assignment.
      if (value === name) continue;
      findings.push(`${file}:${i + 1}  ${name} has a non-placeholder value`);
    }
  });
}

if (findings.length > 0) {
  console.error("check:secrets FAILED — a real secret may be committed");
  for (const f of findings) console.error(`  - ${f}`);
  console.error("\nIf a secret was committed, rotate it. Removing the line is");
  console.error("not enough — the value is already in the git history.");
  process.exit(1);
}

console.log(`check:secrets OK (${tracked.length} tracked files scanned)`);
