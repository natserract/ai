#!/usr/bin/env node
// Layered act-sdlc configuration. First match wins:
//   env var > act/config.local.json > act/config.json > ~/.config/act-sdlc/config.json > default
// CLI flags sit above all of these and are applied by each script.
//
//   node config.mjs show
//   node config.mjs get <key>
//   node config.mjs set <key> <value> [--user|--project|--local]   (default --user)
//   node config.mjs unset <key> [--user|--project|--local]
//   node config.mjs init                                           create act/ in the current project

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { resolveLanguage } from "./languages.mjs";
import { PROVIDERS } from "./providers.mjs";

export const PROJECT_DIR = "act";

const BOOLEAN_WORDS = { true: true, on: true, 1: true, false: false, off: false, 0: false };

export const SCHEMA = {
  "translate.auto": {
    type: "boolean",
    default: false,
    env: "SDLC_AUTO_TRANSLATE",
    description: "Translate automatically when a prompt contains a Linear issue URL",
  },
  "translate.language": {
    type: "string",
    default: "id",
    env: "SDLC_TRANSLATE_LANG",
    description: "Target language as a country code (id, in, my, jp, ...)",
    normalize: (v) => v.trim().toLowerCase(),
    validate: (v) => resolveLanguage(v) !== null || `unknown language code "${v}". Run translate.mjs --list-languages.`,
  },
  "translate.provider": {
    type: "string",
    default: "gemini",
    env: "SDLC_TRANSLATE_PROVIDER",
    description: "Translation model provider",
    validate: (v) => v in PROVIDERS || `unknown provider "${v}". Use one of: ${Object.keys(PROVIDERS).join(", ")}`,
  },
  "translate.model": {
    type: "string",
    default: "",
    env: "SDLC_TRANSLATE_MODEL",
    description: "Model ID override; empty means the provider default",
  },
};

export function profileDir() {
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "act-sdlc");
}

// The nearest ancestor with act/config.json or .git, else cwd. Never climbs out of a git repo.
export function findProjectRoot(cwd) {
  const start = resolve(cwd);
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, PROJECT_DIR, "config.json")) || existsSync(join(dir, ".git"))) return dir;
    if (dirname(dir) === dir) return start;
  }
}

export function layerFiles(cwd) {
  const root = findProjectRoot(cwd);
  return {
    local: join(root, PROJECT_DIR, "config.local.json"),
    project: join(root, PROJECT_DIR, "config.json"),
    user: join(profileDir(), "config.json"),
  };
}

function readJson(file) {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`${file} is not valid JSON: ${err.message}`);
  }
}

const getPath = (obj, key) => key.split(".").reduce((o, part) => (o == null ? undefined : o[part]), obj);

function setPath(obj, key, value) {
  const parts = key.split(".");
  const last = parts.pop();
  let node = obj;
  for (const part of parts) node = node[part] ??= {};
  if (value === undefined) delete node[last];
  else node[last] = value;
  return obj;
}

// Turn a raw value (from a file, env var, or command line) into a checked value of the key's type.
export function parseValue(key, raw) {
  const spec = SCHEMA[key];
  let value = raw;
  if (spec.type === "boolean" && typeof raw !== "boolean") {
    value = BOOLEAN_WORDS[String(raw).trim().toLowerCase()];
    if (value === undefined) throw new Error(`${key} must be true or false, got "${raw}"`);
  }
  if (spec.type === "string") {
    if (typeof raw !== "string") throw new Error(`${key} must be a string, got ${JSON.stringify(raw)}`);
    value = spec.normalize ? spec.normalize(raw) : raw;
    const ok = spec.validate ? spec.validate(value) : true;
    if (ok !== true) throw new Error(`${key}: ${ok}`);
  }
  return value;
}

function unknownKeys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix + k;
    if (v && typeof v === "object" && !Array.isArray(v)) return unknownKeys(v, `${key}.`);
    return key in SCHEMA ? [] : [key];
  });
}

// Returns { values, sources, root, files, warnings }. sources[key] names the layer that won.
export function loadConfig(cwd = process.cwd()) {
  const files = layerFiles(cwd);
  const layers = Object.entries(files).map(([scope, file]) => ({ scope, file, data: readJson(file) }));
  const warnings = layers.flatMap(({ file, data }) => unknownKeys(data).map((k) => `${file}: unknown key "${k}" ignored`));

  const values = {};
  const sources = {};
  for (const [key, spec] of Object.entries(SCHEMA)) {
    const candidates = [
      { scope: `env ${spec.env}`, raw: process.env[spec.env] || undefined },
      ...layers.map(({ scope, file, data }) => ({ scope, file, raw: getPath(data, key) })),
    ];
    const hit = candidates.find((c) => c.raw !== undefined);
    if (!hit) {
      values[key] = spec.default;
      sources[key] = "default";
      continue;
    }
    try {
      values[key] = parseValue(key, hit.raw);
      sources[key] = hit.scope;
    } catch (err) {
      throw new Error(hit.file ? `${hit.file}: ${err.message}` : `${hit.scope}: ${err.message}`);
    }
  }
  return { values, sources, root: findProjectRoot(cwd), files, warnings };
}

const GITIGNORE = `# Personal files, not shared with the team
config.local.json
issues/
`;

// Create act/config.json and act/.gitignore if missing. Never overwrites.
export async function initProject(cwd = process.cwd()) {
  const root = findProjectRoot(cwd);
  const dir = join(root, PROJECT_DIR);
  await mkdir(dir, { recursive: true });
  const created = [];
  for (const [name, content] of [["config.json", "{}\n"], [".gitignore", GITIGNORE]]) {
    const file = join(dir, name);
    if (existsSync(file)) continue;
    await writeFile(file, content);
    created.push(file);
  }
  return { root, dir, created };
}

async function writeLayer(scope, key, value, cwd) {
  if (scope !== "user") await initProject(cwd);
  const file = layerFiles(cwd)[scope];
  const data = setPath(readJson(file), key, value);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

async function main() {
  const { values: flags, positionals } = parseArgs({
    allowPositionals: true,
    options: { user: { type: "boolean" }, project: { type: "boolean" }, local: { type: "boolean" } },
  });
  const [command = "show", key, rawValue] = positionals;
  const scopes = ["user", "project", "local"].filter((s) => flags[s]);
  if (scopes.length > 1) throw new Error("pick one of --user, --project, --local");
  const scope = scopes[0] ?? "user";
  const checkKey = () => {
    if (!(key in SCHEMA)) throw new Error(`unknown key "${key}". Known keys: ${Object.keys(SCHEMA).join(", ")}`);
  };

  if (command === "show") {
    const { values, sources, root, files, warnings } = loadConfig();
    console.log(`project root: ${root}`);
    for (const [scope, file] of Object.entries(files)) console.log(`${scope.padEnd(8)} ${file}${existsSync(file) ? "" : " (none)"}`);
    console.log();
    for (const k of Object.keys(SCHEMA)) {
      const shown = values[k] === "" ? '""' : String(values[k]);
      console.log(`${k.padEnd(20)} ${shown.padEnd(10)} ${sources[k]}`);
    }
    for (const w of warnings) console.log(`warning: ${w}`);
  } else if (command === "get") {
    checkKey();
    console.log(String(loadConfig().values[key]));
  } else if (command === "set") {
    checkKey();
    if (rawValue === undefined) throw new Error("usage: config.mjs set <key> <value> [--user|--project|--local]");
    const value = parseValue(key, rawValue);
    const file = await writeLayer(scope, key, value, process.cwd());
    console.log(`${key} = ${JSON.stringify(value)} → ${file}`);
  } else if (command === "unset") {
    checkKey();
    const file = await writeLayer(scope, key, undefined, process.cwd());
    console.log(`removed ${key} from ${file}`);
  } else if (command === "init") {
    const { dir, created } = await initProject();
    console.log(created.length ? created.map((f) => `created ${f}`).join("\n") : `${dir} already set up, nothing changed`);
  } else {
    throw new Error(`unknown command "${command}". Use show, get, set, unset, or init.`);
  }
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(`config: ${err.message}`);
    process.exit(1);
  });
}
