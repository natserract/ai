#!/usr/bin/env node
// /act-sdlc:help — every command, your setup, and a suggestion for the repo you're in.
// The command list is read from the installed skills, so it can't drift from what exists.
//
//   node help.mjs              overview
//   node help.mjs <command>    one command in detail (e.g. "start" or "/act-sdlc:start")

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, workspaceDir } from "./config.mjs";
import { loadEnv } from "./env.mjs";
import { PROVIDERS } from "./providers.mjs";

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Groups and one-line summaries for the overview. Skills not listed still show, under "Other".
const GROUPS = [
  ["Day to day", ["plan", "to-spec", "start", "verify", "status", "review"]],
  ["Reading", ["open", "translate-issue"]],
  ["Setup", ["init", "setup", "config", "help"]],
];
const SUMMARY = {
  plan: "Triage an issue; split big ones into sub-issues",
  "to-spec": "Write the issue's RFC and post it to Linear",
  start: "Build the next RFC task in this repo",
  verify: "Check finished work: tests, design, security",
  status: "Where an issue stands, and what's next",
  review: "Review a pull request (link, #n, or issue)",
  open: "Open the RFC in your language",
  "translate-issue": "Translate a Linear issue",
  init: "Create your workspace ~/.act/ (once)",
  setup: "Add or check your translation API key",
  config: "Show or change your settings",
  help: "This overview, or help for one command",
};

function frontmatter(file) {
  const block = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const field = (name) => block.match(new RegExp(`^${name}:\\s*(.*)$`, "m"))?.[1]?.replace(/^"(.*)"$/, "$1").trim() ?? "";
  return { name: field("name"), description: field("description"), hint: field("argument-hint") };
}

function skills() {
  const dir = join(pluginRoot, "skills");
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "SKILL.md")))
    .map((d) => frontmatter(join(dir, d.name, "SKILL.md")));
}

function version() {
  try {
    return JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8")).version ?? "";
  } catch {
    return "";
  }
}

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function overview(all) {
  const byName = Object.fromEntries(all.map((s) => [s.name, s]));
  const listed = new Set(GROUPS.flatMap(([, names]) => names));
  const groups = [...GROUPS, ["Other", all.map((s) => s.name).filter((n) => !listed.has(n))]];
  const width = Math.max(...all.map((s) => s.name.length)) + 11;
  const lines = [`act-sdlc ${version()} · ${all.length} commands`];
  for (const [title, names] of groups) {
    const present = names.filter((n) => byName[n]);
    if (!present.length) continue;
    lines.push("", title);
    for (const n of present) {
      const summary = SUMMARY[n] ?? byName[n].description.split(". ")[0];
      lines.push(`  ${`/act-sdlc:${n}`.padEnd(width)} ${summary}`);
    }
  }
  lines.push("", "Typical flow: plan → to-spec → (approve in Linear) → start → verify → release");
  return lines;
}

function setup() {
  const lines = ["", "Your setup"];
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    return [...lines, `  ✗ settings: ${err.message}`];
  }
  const v = config.values;
  const ws = existsSync(join(workspaceDir(), "openspec"));
  lines.push(`  ${ws ? "✓" : "✗"} workspace   ${workspaceDir()}${ws ? "" : "  → run /act-sdlc:init"}`);
  loadEnv();
  const provider = PROVIDERS[v["translate.provider"]];
  const hasKey = provider && Boolean(process.env[provider.keyEnv]);
  lines.push(`  ${hasKey ? "✓" : "✗"} API key     ${provider?.keyEnv ?? "?"} (${v["translate.provider"]})${hasKey ? "" : "  → run /act-sdlc:setup (only needed for translation)"}`);
  lines.push(`    language ${v["translate.language"]} · publish RFCs ${v["rfc.publish"] ? "on" : "off"} · auto-split ${v["plan.autoSplit"] ? "on" : "off"} · auto-translate ${v["translate.auto"] ? "on" : "off"}${v["start.skills"] ? ` · start skills: ${v["start.skills"]}` : ""}`);
  return lines;
}

function here() {
  const root = git(["rev-parse", "--show-toplevel"]);
  if (!root) return ["", "Here", "  Not in a git repository. /start and /verify run inside one of your app repos."];
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "?";
  const key = branch.match(/(?:^|[/_-])([a-z]+-\d+)(?=[-_/]|$)/i)?.[1]?.toUpperCase() ?? null;
  const lines = ["", "Here", `  repo ${basename(root)} · branch ${branch}`];
  if (key) lines.push(`  This branch looks like ${key}. Next: /act-sdlc:status ${key}`);
  else lines.push("  No issue key in the branch name. Start with /act-sdlc:status <issue> or /act-sdlc:plan <issue>.");
  return lines;
}

function detail(all, name) {
  const n = name.replace(/^\/?act-sdlc:/, "");
  const s = all.find((x) => x.name === n);
  if (!s) throw new Error(`no command "${name}". Commands: ${all.map((x) => x.name).join(", ")}`);
  return [
    `/act-sdlc:${s.name} ${s.hint}`.trim(),
    "",
    s.description,
    "",
    `Full instructions: ${join(pluginRoot, "skills", s.name, "SKILL.md")}`,
  ];
}

function main() {
  const all = skills().sort((a, b) => a.name.localeCompare(b.name));
  const arg = process.argv[2];
  const lines = arg ? detail(all, arg) : [...overview(all), ...setup(), ...here(), "", "Details for one command: /act-sdlc:help <command>"];
  console.log(lines.join("\n"));
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    main();
  } catch (err) {
    console.error(`help: ${err.message}`);
    process.exit(1);
  }
}
