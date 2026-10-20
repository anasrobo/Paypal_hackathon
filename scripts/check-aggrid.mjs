#!/usr/bin/env node
// Guards the AG Grid licence boundary.
//
// Two independent reasons this project is on AG Grid Community only:
//   1. It is the free tier, as chosen.
//   2. This repository is GPL-3.0 and AG Grid Enterprise is a commercial
//      licence. Using Enterprise here would be a licence violation.
//      See docs/DECISIONS.md D-008.
//
// The Server-Side Row Model is Enterprise-only; the Community equivalent is
// the `infinite` row model, which the ledger uses.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", ".vercel", "out", "coverage",
  "playwright-report", "test-results", "blob-report", ".firecrawl",
]);

const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx", ".txt",
]);

const failures = [];

// 1. No Enterprise package in package.json.
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
for (const group of ["dependencies", "devDependencies", "peerDependencies"]) {
  for (const name of Object.keys(pkg[group] ?? {})) {
    if (/ag-grid-enterprise/i.test(name)) {
      failures.push(`package.json ${group}.${name} — AG Grid Enterprise is commercial and violates GPL-3.0`);
    }
  }
}

// 2. No Enterprise features referenced in source.
const SOURCE_FORBIDDEN = [
  { pattern: /ag-grid-enterprise/i, why: "AG Grid Enterprise import" },
  { pattern: /licenseKey/i, why: "AG Grid licence key (Enterprise feature)" },
  { pattern: /serverSideRowModel/i, why: "Server-Side Row Model is Enterprise-only; use the 'infinite' row model" },
  { pattern: /agSetColumnFilter/i, why: "the Set Filter is Enterprise-only in AG Grid v34; use a text filter" },
  { pattern: /agMultiColumnFilter/i, why: "the Multi Filter is Enterprise-only; use one filter per column" },
  { pattern: /agSetFilter/i, why: "the Set Filter is Enterprise-only in AG Grid v34; use a text filter" },
  { pattern: /ag-theme-alpine|ag-theme-quartz|ag-theme-material/i, why: "legacy CSS theme; use the Theming API (themeQuartz.withParams)" },
];

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

for (const file of walk(join(ROOT, "src"))) {
  if (!TEXT_EXT.has(extname(file))) continue;
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const { pattern, why } of SOURCE_FORBIDDEN) {
      if (pattern.test(line)) {
        failures.push(`${rel}:${i + 1}  ${why}`);
      }
    }
  });
}

if (failures.length > 0) {
  console.error("check:aggrid FAILED");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("check:aggrid OK — Community only, no Enterprise features referenced");
