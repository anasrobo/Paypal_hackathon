#!/usr/bin/env node
// Prints the ONE task to work on next, with its read list, write list and
// acceptance command.
//
// The point of this script is to bound every working session. An agent that
// can see the whole queue will try to do the whole queue. One task, one
// verification, then update the protocol files and stop.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const queuePath = join(ROOT, "docs/TASK_QUEUE.md");

if (!existsSync(queuePath)) {
  console.error("next-task: docs/TASK_QUEUE.md is missing");
  process.exit(1);
}

const queue = readFileSync(queuePath, "utf8");
const TASK_RE = /^- \[( |x|X)\] (T\d+-\d+) (.+?) \(deps: ([^)]*)\) \(files: ([^)]*)\) \(accept: (.+)\)\s*$/gm;

const tasks = [];
let m;
while ((m = TASK_RE.exec(queue)) !== null) {
  const [, mark, id, title, deps, files, accept] = m;
  tasks.push({
    id,
    title,
    deps: deps.trim() === "none" ? [] : deps.trim().split(/\s+/),
    files: files.trim(),
    accept: accept.trim(),
    done: mark !== " ",
  });
}

const done = new Set(tasks.filter((t) => t.done).map((t) => t.id));
const next = tasks.find((t) => !t.done && t.deps.every((d) => done.has(d)));

if (!next) {
  const remaining = tasks.filter((t) => !t.done);
  if (remaining.length === 0) {
    console.log("next-task: every task in the queue is checked off.");
  } else {
    console.log("next-task: no task is currently unblocked.");
    for (const t of remaining) {
      console.log(`  ${t.id}  ${t.title}   (waiting on: ${t.deps.join(", ")})`);
    }
  }
  process.exit(0);
}

console.log("=".repeat(72));
console.log(`NEXT TASK   ${next.id}  ${next.title}`);
console.log("=".repeat(72));
console.log(`\nDepends on : ${next.deps.length ? next.deps.join(", ") : "nothing"}`);
console.log(`May write  : ${next.files}`);
console.log(`Proves it  : ${next.accept}`);
console.log("\nRules for this task:");
console.log("  - Read only what you need. Cap any read at 80 lines.");
console.log("  - Do not re-read a file you already read this session.");
console.log("  - Do only this task. If you discover more work, append it to the");
console.log("    bottom of docs/TASK_QUEUE.md with a [NEW] prefix.");
console.log("  - When the accept command passes, tick the task in");
console.log("    docs/TASK_QUEUE.md and update docs/BUILD_STATE.md.");
console.log("");
