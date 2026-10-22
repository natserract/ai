#!/usr/bin/env node
// Runs a pinned OpenSpec CLI against the developer's workspace (~/.act/openspec/), so every
// developer gets the same version without a global install. OpenSpec finds openspec/ by walking
// up from its working directory, so commands run with cwd = the workspace.
//
//   node openspec.mjs <openspec args...>     e.g. validate act-95-trial-abuse --strict --json

import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { workspaceDir } from "./config.mjs";

export const OPENSPEC_VERSION = "1.14.3";

const command = ["npx", "-y", `@fission-ai/openspec@${OPENSPEC_VERSION}`];
const env = { ...process.env, OPENSPEC_TELEMETRY: "0" };

// Resolves { code, stdout, stderr, data }. data is the parsed JSON when --json was passed.
// A non-zero exit is not an error here: `validate` exits 1 for an invalid change and still prints JSON.
export function runOpenspec(args, { cwd = workspaceDir() } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], [...command.slice(1), ...args], { cwd, env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (err) => reject(new Error(`could not run OpenSpec through npx: ${err.message}`)));
    child.on("close", (code) => {
      let data;
      if (args.includes("--json")) {
        try {
          data = JSON.parse(stdout);
        } catch {
          return reject(new Error(`openspec ${args[0]} printed no JSON (exit ${code}): ${(stderr || stdout).trim().slice(0, 500)}`));
        }
      }
      resolve({ code, stdout, stderr, data });
    });
  });
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  const child = spawn(command[0], [...command.slice(1), ...process.argv.slice(2)], { cwd: workspaceDir(), env, stdio: "inherit" });
  child.on("error", (err) => {
    console.error(`openspec: could not run through npx: ${err.message}`);
    process.exit(1);
  });
  child.on("close", (code) => process.exit(code ?? 1));
}
