#!/usr/bin/env node
// act-sdlc lives outside every app repo, in two places per developer:
//   profile    ~/.config/act-sdlc/   config.json (settings) and .env (API keys)
//   workspace  ~/.act/               OpenSpec drafts, RFC exports, translations ($ACT_HOME to move it)
// The shared copy of each spec is the RFC document on the Linear issue, published by /to-spec.
//
// Settings: env var > ~/.config/act-sdlc/config.json > default. CLI flags of each script win over all.
//
//   node config.mjs show
//   node config.mjs get <key>
//   node config.mjs set <key> <value>
//   node config.mjs unset <key>
//   node config.mjs init          create the workspace (~/.act/ with openspec/)

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { resolveLanguage } from "./languages.mjs";
import { PROVIDERS } from "./providers.mjs";

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
  "phases.lightLabels": {
    type: "string",
    default: "Small Size",
    env: "SDLC_LIGHT_LABELS",
    description: "Comma-separated Linear labels whose issues take the light path (one-line design)",
  },
  "phases.callGraph": {
    type: "boolean",
    default: true,
    env: "SDLC_CALL_GRAPH",
    description: "Full-path RFCs must have a Call Graph section (docs/call-graph.md)",
  },
  "start.skills": {
    type: "string",
    default: "",
    env: "SDLC_START_SKILLS",
    description: "Comma-separated skills /start invokes for every code task, in order (e.g. pstack:tdd,code-review)",
  },
  "plan.autoSplit": {
    type: "boolean",
    default: true,
    env: "SDLC_PLAN_AUTO_SPLIT",
    description: "/plan creates decision and work sub-issues in Linear when an issue is too large",
  },
  "rfc.publish": {
    type: "boolean",
    default: true,
    env: "SDLC_RFC_PUBLISH",
    description: "/to-spec writes the RFC document and a notification comment to the Linear issue",
  },
};

export function profileDir() {
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "act-sdlc");
}

export function workspaceDir() {
  return process.env.ACT_HOME || join(homedir(), ".act");
}

const configFile = () => join(profileDir(), "config.json");

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

// Returns { values, sources, file, workspace, warnings }. sources[key] is "env <VAR>", "profile", or "default".
export function loadConfig() {
  const file = configFile();
  const data = readJson(file);
  const warnings = unknownKeys(data).map((k) => `${file}: unknown key "${k}" ignored`);
  const values = {};
  const sources = {};
  for (const [key, spec] of Object.entries(SCHEMA)) {
    const fromEnv = process.env[spec.env] || undefined;
    const raw = fromEnv ?? getPath(data, key);
    if (raw === undefined) {
      values[key] = spec.default;
      sources[key] = "default";
      continue;
    }
    try {
      values[key] = parseValue(key, raw);
    } catch (err) {
      throw new Error(`${fromEnv !== undefined ? `env ${spec.env}` : file}: ${err.message}`);
    }
    sources[key] = fromEnv !== undefined ? `env ${spec.env}` : "profile";
  }
  return { values, sources, file, workspace: workspaceDir(), warnings };
}

// Rules OpenSpec hands to every design and tasks artifact in the workspace.
export const OPENSPEC_RULES = `
# act-sdlc defaults: Call Graph Planning (see docs/call-graph.md in the act-sdlc plugin).
# Edit or remove these rules to change what every RFC drafted in this workspace contains.
rules:
  design:
    - 'Include a "## Call Graph" section, drawn before any code is written.'
    - 'Default format: a Mermaid flowchart of the happy path plus failure edges, then a node table with columns Node, Input → Output, Kind, Needs, On failure. Use a Mermaid sequence diagram when the flow crosses services or repositories.'
    - 'Annotate every node with its kind (one-shot, stream, cached, boundary), what it needs, and its failure handling (retry, fallback, or fail, with the error name).'
    - 'Parse untrusted input only at boundary nodes. End the section with a "Tests:" line naming the dependencies swapped in tests without changing the graph.'
    - 'For small changes, numbered steps are enough instead of a diagram.'
    - 'Add an "Ask" column to the node table: for existing code, who to ask (CODEOWNERS first, else the main authors from git history, as a Linear @mention or GitHub @login with the last change date; never an email); for new nodes, "owner of task X.Y".'
    - 'After the Call Graph, add a "### Context & people" section: related issues and RFCs and the decisions they record, recent PRs that changed the involved code (number, author, date), people who know the domain, and linked threads, each with its source and an as-of date.'
  tasks:
    - 'Derive tasks from the Call Graph nodes, leaves first. Each task names the node it implements and how its dependencies are swapped in tests.'
    - 'Start each task with the repository it changes in square brackets, for example "[archix_cms_backend]", because one RFC can span several repositories.'
`;

// Create ~/.act/ with an OpenSpec store inside. Never overwrites.
export async function initWorkspace() {
  const dir = workspaceDir();
  const created = [];
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
    created.push(`${dir}/`);
  }
  const openspecDir = join(dir, "openspec");
  if (!existsSync(openspecDir)) {
    const { runOpenspec } = await import("./openspec.mjs");
    const { code, stderr, stdout } = await runOpenspec(["init", ".", "--tools", "none"], { cwd: dir });
    if (code !== 0) throw new Error(`openspec init failed: ${(stderr || stdout).trim().slice(0, 500)}`);
    await appendFile(join(openspecDir, "config.yaml"), OPENSPEC_RULES);
    created.push(`${openspecDir}/`);
  }
  return { dir, created };
}

async function writeProfile(key, value) {
  const file = configFile();
  const data = setPath(readJson(file), key, value);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

async function main() {
  const { positionals } = parseArgs({ allowPositionals: true, strict: false });
  const [command = "show", key, rawValue] = positionals;
  if (process.argv.some((a) => a === "--project" || a === "--local")) {
    throw new Error("--project and --local were removed: settings now live only in your profile, and app repos stay untouched.");
  }
  const checkKey = () => {
    if (!(key in SCHEMA)) throw new Error(`unknown key "${key}". Known keys: ${Object.keys(SCHEMA).join(", ")}`);
  };

  if (command === "show") {
    const { values, sources, file, workspace, warnings } = loadConfig();
    console.log(`profile    ${file}${existsSync(file) ? "" : " (none)"}`);
    console.log(`workspace  ${workspace}${existsSync(join(workspace, "openspec")) ? "" : " (not set up: run init)"}`);
    console.log();
    for (const k of Object.keys(SCHEMA)) {
      const shown = values[k] === "" ? '""' : String(values[k]);
      console.log(`${k.padEnd(20)} ${shown.padEnd(12)} ${sources[k]}`);
    }
    for (const w of warnings) console.log(`warning: ${w}`);
  } else if (command === "get") {
    checkKey();
    console.log(String(loadConfig().values[key]));
  } else if (command === "set") {
    checkKey();
    if (rawValue === undefined) throw new Error("usage: config.mjs set <key> <value>");
    const value = parseValue(key, rawValue);
    console.log(`${key} = ${JSON.stringify(value)} → ${await writeProfile(key, value)}`);
  } else if (command === "unset") {
    checkKey();
    console.log(`removed ${key} from ${await writeProfile(key, undefined)}`);
  } else if (command === "init") {
    const { dir, created } = await initWorkspace();
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
