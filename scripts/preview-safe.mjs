import { rmSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const cwd = process.cwd();
const nextDir = path.join(cwd, ".next");
const extraArgs = process.argv.slice(2);

function sanitizeNodeOptions(value) {
  if (!value) return value;
  const sanitized = value
    .replace(/--localstorage-file(?:=\S+)?(?:\s+\S+)?/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || undefined;
}

const env = { ...process.env };
const sanitizedNodeOptions = sanitizeNodeOptions(env.NODE_OPTIONS);
if (sanitizedNodeOptions) {
  env.NODE_OPTIONS = sanitizedNodeOptions;
} else {
  delete env.NODE_OPTIONS;
}

try {
  rmSync(nextDir, { recursive: true, force: true });
  console.log("[preview-safe] cleared .next cache");
} catch (error) {
  console.warn("[preview-safe] failed to clear .next cache:", error);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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
      if ((code ?? 0) !== 0) {
        reject(new Error(`${command} ${args.join(" ")} failed with code ${code ?? 0}`));
        return;
      }
      resolve(undefined);
    });
  });
}

await run("npx", ["next", "build"]);
await run("npx", ["next", "start", ...extraArgs]);
