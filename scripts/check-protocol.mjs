#!/usr/bin/env node
// Makes the build protocol mechanical instead of aspirational.
//
// Checks:
//   1. docs/BUILD_STATE.md has a parseable header block with every key.
//   2. docs/TASK_QUEUE.md task lines are well formed, their dependencies
//      exist, and every dependency is already checked and appears earlier.
//   3. docs/ATTEMPTS.md — a task with three or more FAILED attempts must have
//      a matching BLOCKER block in BUILD_STATE.md. This is the Three-Strike
//      Rule, enforced.
//   4. docs/DECISIONS.md contains every frozen decision.
//   5. The phase-2 freeze: once docs/frozen-deps.json exists, no dependency
//      and no top-level src/ directory may be added without a new decision.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const failures = [];

const read = (p) => {
  const full = join(ROOT, p);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
};

// ---------------------------------------------------------------- 1. state
const state = read("docs/BUILD_STATE.md");
if (!state) {
  failures.push("docs/BUILD_STATE.md is missing");
} else {
  const m = state.match(
    /<!-- GROUNDTRUTH:BUILD_STATE:BEGIN -->([\s\S]*?)<!-- GROUNDTRUTH:BUILD_STATE:END -->/,
  );
  if (!m) {
    failures.push("BUILD_STATE.md is missing the GROUNDTRUTH:BUILD_STATE header block");
  } else {
    for (const key of ["phase", "status", "task", "last_test", "attempts", "commit"]) {
      if (!new RegExp(`^${key}:\\s*\\S`, "m").test(m[1])) {
        failures.push(`BUILD_STATE.md header is missing "${key}:"`);
      }
    }
  }
}

// ---------------------------------------------------------------- 2. queue
const queue = read("docs/TASK_QUEUE.md");
const tasks = new Map();
if (!queue) {
  failures.push("docs/TASK_QUEUE.md is missing");
} else {
  const TASK_RE = /^- \[( |x|X)\] (T\d+-\d+) (.+?) \(deps: ([^)]*)\) \(files: ([^)]*)\) \(accept: (.+)\)\s*$/gm;
  const order = [];
  let match;
  while ((match = TASK_RE.exec(queue)) !== null) {
    const [, mark, id, title, deps, files, accept] = match;
    const depList = deps.trim() === "none" ? [] : deps.trim().split(/\s+/);
    tasks.set(id, { id, title, deps: depList, files: files.trim(), accept: accept.trim(), done: mark !== " " });
    order.push(id);
  }
  if (tasks.size === 0) failures.push("TASK_QUEUE.md contains no parsable task lines");

  for (const id of order) {
    const t = tasks.get(id);
    for (const dep of t.deps) {
      if (!tasks.has(dep)) {
        failures.push(`${id} depends on unknown task ${dep}`);
        continue;
      }
      // The rule is about tasks that are ALREADY done: a task may not be
      // ticked off unless its dependencies were ticked off first, and they
      // must appear earlier in the queue. An unticked future task whose
      // dependencies are not yet done is perfectly normal.
      if (t.done) {
        if (!tasks.get(dep).done) {
          failures.push(`${id} is checked off but depends on ${dep}, which is not`);
        }
        if (order.indexOf(dep) > order.indexOf(id)) {
          failures.push(`${id} is checked off but depends on ${dep}, which appears later in the queue`);
        }
      }
    }
  }
}

// ------------------------------------------------------------- 3. attempts
const attempts = read("docs/ATTEMPTS.md");
if (attempts && state) {
  const failedByTask = new Map();
  for (const line of attempts.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 6) continue;
    const [task, , , , result] = cells;
    if (!/^T\d+-\d+$/.test(task)) continue;
    if (!/^FAILED$/i.test(result)) continue;
    failedByTask.set(task, (failedByTask.get(task) ?? 0) + 1);
  }
  for (const [task, count] of failedByTask) {
    if (count >= 3) {
      const hasBlocker = /### BLOCKER/.test(state) && state.includes(task);
      if (!hasBlocker) {
        failures.push(
          `${task} has ${count} FAILED attempts but no BLOCKER block in BUILD_STATE.md — apply the Three-Strike Rule`,
        );
      }
    }
  }
}

// ------------------------------------------------------------ 4. decisions
const decisions = read("docs/DECISIONS.md");
if (!decisions) {
  failures.push("docs/DECISIONS.md is missing");
} else {
  for (let i = 0; i <= 12; i++) {
    const id = `D-${String(i).padStart(3, "0")}`;
    if (!decisions.includes(`## ${id} `)) {
      failures.push(`DECISIONS.md is missing ${id}`);
    }
  }
}

// ---------------------------------------------------------------- 5. freeze
const frozenPath = join(ROOT, "docs/frozen-deps.json");
if (existsSync(frozenPath) && state) {
  const phase = Number((state.match(/^phase:\s*(\d+)/m) ?? [])[1] ?? 0);
  if (phase >= 2) {
    const frozen = JSON.parse(readFileSync(frozenPath, "utf8"));
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const now = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const dep of Object.keys(now)) {
      if (!(dep in (frozen.dependencies ?? {}))) {
        failures.push(
          `dependency "${dep}" was added after the phase-2 freeze — add a DECISIONS entry first`,
        );
      }
    }
    const srcDir = join(ROOT, "src");
    if (existsSync(srcDir)) {
      for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
        if (entry.isDirectory() && !(frozen.srcDirs ?? []).includes(entry.name)) {
          failures.push(
            `src/${entry.name} was added after the phase-2 freeze — add a DECISIONS entry first`,
          );
        }
      }
    }
  }
}

// ------------------------------------------------------------------ report
if (failures.length > 0) {
  console.error("check:protocol FAILED");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `check:protocol OK (${tasks.size} tasks, state header valid, decisions present)`,
);
