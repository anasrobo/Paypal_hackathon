#!/usr/bin/env node
// Writes docs/frozen-deps.json — the phase-2 freeze.
//
// Once this file exists, `scripts/check-protocol.mjs` FAILS THE BUILD if a
// dependency or a top-level `src/` directory is added without a new entry in
// docs/DECISIONS.md. The freeze is what makes "no re-architecture after phase
// 2" mechanical instead of aspirational.
//
// It is generated from package.json and the filesystem, so it can never drift
// from the truth. Run it deliberately, when a decision has been recorded:
//
//   node scripts/freeze-deps.mjs
//
// It is NOT part of `npm run verify`, because regenerating it would defeat
// the check. The check only ever READS it.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

const srcDirs = readdirSync(join(ROOT, "src"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const frozen = {
  note:
    "The phase-2 freeze. A dependency or a top-level src/ directory added after " +
    "this file was written requires a new entry in docs/DECISIONS.md. " +
    "Regenerate with: node scripts/freeze-deps.mjs",
  dependencies: { ...(pkg.dependencies ?? {}) },
  devDependencies: { ...(pkg.devDependencies ?? {}) },
  srcDirs,
};

writeFileSync(
  join(ROOT, "docs", "frozen-deps.json"),
  `${JSON.stringify(frozen, null, 2)}\n`,
  "utf8",
);

console.log(
  `frozen ${Object.keys(frozen.dependencies).length} dependencies, ` +
    `${Object.keys(frozen.devDependencies).length} dev dependencies, ` +
    `${srcDirs.length} src directories`,
);
