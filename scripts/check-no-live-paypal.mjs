#!/usr/bin/env node
// Fails the build if a LIVE PayPal endpoint appears anywhere in the repo.
//
// GroundTruth talks to PayPal Sandbox only. The live hosts below must not
// exist in any file — source, test, doc, comment or example. A single
// accidental live host in a config file would move real money.
//
// The sandbox host `api-m.sandbox.paypal.com` does NOT contain any of these
// patterns, so it is allowed and needs no exemption.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".vercel",
  "out",
  "coverage",
  "playwright-report",
  "test-results",
  "blob-report",
  ".firecrawl",
]);

const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx",
  ".txt", ".sql", ".yml", ".yaml", ".toml", ".css", ".html", ".sh", ".ps1",
  ".env", ".example", "",
]);

const FORBIDDEN = [
  { pattern: /api-m\.paypal\.com/i, why: "PayPal live API host", codeOnly: false },
  { pattern: /api\.paypal\.com/i, why: "PayPal live API host", codeOnly: false },
  { pattern: /api-3t\.paypal\.com/i, why: "PayPal live API host", codeOnly: false },
  { pattern: /svcs\.paypal\.com/i, why: "PayPal live API host", codeOnly: false },
  // The classic web host is only a risk in code, where it could be used as a
  // redirect target for a payout. A documentation link in prose is harmless.
  { pattern: /www\.paypal\.com/i, why: "PayPal live web host", codeOnly: true },
  { pattern: /PAYPAL_PROVIDER\s*[:=]\s*["']?live/i, why: "live provider mode", codeOnly: false },
  {
    pattern: /PAYPAL_SANDBOX_BASE_URL\s*=\s*https:\/\/(?!api-m\.sandbox)/i,
    why: "non-sandbox PayPal base URL",
    codeOnly: false,
  },
];

// Vendored third-party captures. These are evidence, quoted verbatim from
// PayPal's own documentation, and are never executed. They are exempt.
const VENDORED_DIRS = new Set(["docs/research"]);

function isVendored(rel) {
  return VENDORED_DIRS.has(rel.split("/")[0] + "/" + rel.split("/")[1]);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else if (entry.isFile()) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const findings = [];

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (isVendored(rel)) continue;
  if (!TEXT_EXT.has(extname(file))) continue;
  const isMarkdown = extname(file) === ".md" || extname(file) === ".mdx";
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

  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const { pattern, why, codeOnly } of FORBIDDEN) {
      if (codeOnly && isMarkdown) continue;
      if (pattern.test(line)) {
        findings.push(`${rel}:${i + 1}  ${why}\n      ${line.trim().slice(0, 120)}`);
      }
    }
  });
}

if (findings.length > 0) {
  console.error("check:paypal FAILED — a live PayPal endpoint is present");
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("check:paypal OK — no live PayPal host found");
