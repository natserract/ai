#!/usr/bin/env node
// Set up translation API keys in the developer profile's .env (~/.config/act-sdlc/.env).
//
//   node setup.mjs                       interactive: pick a provider, paste the key (hidden), verify it
//   node setup.mjs --status              show which keys are set and where they come from
//   node setup.mjs --check [--provider]  call each configured provider to confirm its key works
//   node setup.mjs --set NAME=VALUE      save one variable without prompting, then verify it

import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs, parseEnv } from "node:util";
import { loadConfig } from "./config.mjs";
import { ENV_FILE, loadEnv } from "./env.mjs";
import { PROVIDERS } from "./providers.mjs";

const { values } = parseArgs({
  options: {
    status: { type: "boolean" },
    check: { type: "boolean" },
    provider: { type: "string" },
    set: { type: "string" },
  },
});

const fileText = existsSync(ENV_FILE) ? await readFile(ENV_FILE, "utf8") : "";
const fileVars = parseEnv(fileText);
const shellVars = { ...process.env };
loadEnv();

const mask = (v) => (v.length > 8 ? `…${v.slice(-4)}` : "…");

function status() {
  console.log(`env file: ${ENV_FILE}${existsSync(ENV_FILE) ? "" : " (not created yet)"}`);
  for (const [name, { keyEnv }] of Object.entries(PROVIDERS)) {
    const source = shellVars[keyEnv] ? "shell" : fileVars[keyEnv] ? ".env" : null;
    const value = process.env[keyEnv];
    console.log(`  ${name.padEnd(10)} ${keyEnv.padEnd(20)} ${source ? `set (${source}, ${mask(value)})` : "not set"}`);
  }
}

async function check(names) {
  let ok = true;
  for (const name of names) {
    const { keyEnv, check } = PROVIDERS[name];
    const key = process.env[keyEnv];
    if (!key) {
      console.log(`  ${name.padEnd(10)} skipped: ${keyEnv} not set`);
      continue;
    }
    try {
      await check(key);
      console.log(`  ${name.padEnd(10)} ok`);
    } catch (err) {
      ok = false;
      console.log(`  ${name.padEnd(10)} FAILED: ${err.message}`);
    }
  }
  return ok;
}

// Replace the variable's line if present, otherwise append it. Other lines are kept as written.
async function save(name, value) {
  const lines = fileText ? fileText.replace(/\n$/, "").split("\n") : [];
  const index = lines.findIndex((line) => line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1] === name);
  if (index === -1) lines.push(`${name}=${value}`);
  else lines[index] = `${name}=${value}`;
  await mkdir(dirname(ENV_FILE), { recursive: true });
  await writeFile(ENV_FILE, `${lines.join("\n")}\n`);
  await chmod(ENV_FILE, 0o600);
  process.env[name] = value;
  if (shellVars[name] && shellVars[name] !== value) {
    console.log(`note: ${name} is also exported in your shell, and the shell value wins over .env.`);
  }
  console.log(`saved ${name} to ${ENV_FILE}`);
}

// The provider translate-issue would use here; a broken config file shouldn't block setup.
function configuredProvider() {
  try {
    return loadConfig(process.cwd()).values["translate.provider"];
  } catch {
    return "gemini";
  }
}

function providerFor(keyEnv) {
  return Object.keys(PROVIDERS).find((name) => PROVIDERS[name].keyEnv === keyEnv);
}

// Read one line from the terminal without echoing it.
function askHidden(question) {
  const { stdin } = process;
  process.stdout.write(question);
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();
  return new Promise((resolve) => {
    let value = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          process.exit(130);
        }
        if (ch === "\r" || ch === "\n") {
          stdin.off("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write("\n");
          return resolve(value.trim());
        }
        value = ch === "\u007f" || ch === "\b" ? value.slice(0, -1) : value + ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function interactive() {
  const names = Object.keys(PROVIDERS);
  const fallback = configuredProvider();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const picked = (await rl.question(`Provider (${names.join("/")}) [${fallback}]: `)).trim() || fallback;
  rl.close();
  if (!PROVIDERS[picked]) throw new Error(`unknown provider "${picked}"`);
  const { keyEnv } = PROVIDERS[picked];
  const key = await askHidden(`${keyEnv} (input hidden): `);
  if (!key) throw new Error("no key entered, nothing saved");
  await save(keyEnv, key);
  return check([picked]);
}

if (values.provider && !PROVIDERS[values.provider]) {
  console.error(`setup: unknown provider "${values.provider}". Use one of: ${Object.keys(PROVIDERS).join(", ")}`);
  process.exit(1);
}

try {
  let ok = true;
  if (values.set) {
    const [, name, value] = values.set.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.+)$/) ?? [];
    if (!name) throw new Error("--set expects NAME=VALUE");
    await save(name, value);
    const provider = providerFor(name);
    if (provider) ok = await check([provider]);
  } else if (values.check) {
    ok = await check(values.provider ? [values.provider] : Object.keys(PROVIDERS));
  } else if (values.status || !process.stdin.isTTY) {
    status();
    if (!process.stdin.isTTY && !values.status) console.log(`\nTo add a key, run in a terminal: node "${new URL(import.meta.url).pathname}"`);
  } else {
    ok = await interactive();
  }
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error(`setup: ${err.message}`);
  process.exit(1);
}
