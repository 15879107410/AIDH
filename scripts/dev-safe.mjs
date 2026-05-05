import { rmSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const cwd = process.cwd();
const nextDir = path.join(cwd, ".next");

try {
  rmSync(nextDir, { recursive: true, force: true });
  console.log("[dev-safe] cleared .next cache");
} catch (error) {
  console.warn("[dev-safe] failed to clear .next cache:", error);
}

function sanitizeNodeOptions(value) {
  if (!value) return value;
  const sanitized = value
    .replace(/--localstorage-file(?:=\S+)?(?:\s+\S+)?/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || undefined;
}

const args = ["next", "dev", ...process.argv.slice(2)];
const env = { ...process.env };
const sanitizedNodeOptions = sanitizeNodeOptions(env.NODE_OPTIONS);
if (sanitizedNodeOptions) {
  env.NODE_OPTIONS = sanitizedNodeOptions;
} else {
  delete env.NODE_OPTIONS;
}

const child = spawn("npx", args, {
  cwd,
  env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
