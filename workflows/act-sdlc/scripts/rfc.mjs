#!/usr/bin/env node
// One RFC document per Linear issue. Drafts are OpenSpec changes in the workspace
// (~/.act/openspec/changes/<id>/); `export` joins them into a single Markdown document that
// /to-spec publishes as the issue's "RFC: <title>" document (or a person pastes by hand).
// `parse` reads an RFC back (from Linear or a file) for /status and the next phases.
// Linear holds the English RFC only. A translation into your default language stays local.
//
//   ~/.act/rfc/<KEY>.md          English, exactly what's in Linear
//   ~/.act/rfc/<KEY>.<lang>.md   your translation (translate.language), never published
//
//   node rfc.mjs export <KEY> [--title "<issue title>"] [--url <issue url>] [--copy]
//   node rfc.mjs sync <KEY> < rfc.md       store the RFC content read from Linear as the English copy
//   node rfc.mjs translate <KEY> [--lang <code>] [--force]
//   node rfc.mjs open <KEY> [--en] [--lang <code>] [--print]
//   node rfc.mjs open-url <url>
//   node rfc.mjs tasks <file|-> [--repo <name>|.] [--json]   ordered task list, done and open
//   node rfc.mjs tick <task id> <file|->   patch that ticks one task in Linear's RFC content
//   node rfc.mjs verify-patch <repo|.> <pass|fail> "<summary>" <file|->   patch recording a /verify result
//   node rfc.mjs parse <file|->            JSON summary of an RFC document

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadConfig, workspaceDir } from "./config.mjs";
import { resolveLanguage } from "./languages.mjs";

export const RFC_TITLE_PREFIX = "RFC:";

const changesDir = () => join(workspaceDir(), "openspec", "changes");
export const rfcPath = (key, lang = null) => join(workspaceDir(), "rfc", lang ? `${key}.${lang}.md` : `${key}.md`);
const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");

// The draft for an issue: the change whose id is the lowercased key or starts with "<key>-".
export function findChange(key) {
  const dir = changesDir();
  if (!existsSync(dir)) return null;
  const k = key.toLowerCase();
  const ids = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "archive" && (d.name === k || d.name.startsWith(`${k}-`)))
    .map((d) => d.name);
  return ids.length ? { id: ids[0], dir: join(dir, ids[0]), duplicates: ids.slice(1) } : null;
}

// Shift Markdown headings outside code fences by `by` levels, capped at H4 (Linear's deepest).
function demote(md, by) {
  let fenced = false;
  return md
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      if (fenced) return line;
      return line.replace(/^(#{1,6})(\s)/, (_, hashes, space) => "#".repeat(Math.min(hashes.length + by, 4)) + space);
    })
    .join("\n");
}

const stripTitle = (md) => md.replace(/^\s*#\s[^\n]*\n+/, "").trim();

// Spec deltas use H2–H4. Rewrite them to fit under "### <capability>" within Linear's H4 limit.
function specSection(capability, md) {
  let fenced = false;
  const body = stripTitle(md)
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      if (fenced) return line;
      return line
        .replace(/^##\s+Purpose\s*$/i, "**Purpose**")
        .replace(/^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i, (_, op) => `**${op.toUpperCase()}**`)
        .replace(/^###\s+Requirement:\s*/i, "#### Requirement: ")
        .replace(/^####\s+Scenario:\s*(.*)$/i, "**Scenario: $1**");
    })
    .join("\n");
  return `### ${capability}\n\n${body}`;
}

function specFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const path = join(dir, d.name);
    if (d.isDirectory()) return specFiles(path, base);
    return d.name.endsWith(".md") ? [{ capability: relative(base, dir) || d.name.replace(/\.md$/, ""), path }] : [];
  });
}

export function buildRfc(change, { key, title, url }) {
  const heading = `# ${RFC_TITLE_PREFIX} ${title || change.id}`;
  const source = `Linear: ${url ? `[${key}](${url})` : key} · drafted with act-sdlc from OpenSpec change \`${change.id}\``;
  const proposal = demote(stripTitle(read(join(change.dir, "proposal.md"))), 1);
  const specs = specFiles(join(change.dir, "specs")).map(({ capability, path }) => specSection(capability, read(path)));
  const design = demote(stripTitle(read(join(change.dir, "design.md"))), 1);
  const tasks = demote(stripTitle(read(join(change.dir, "tasks.md"))), 1);
  return [
    heading,
    source,
    "## 1. Proposal",
    proposal || "_Not written yet._",
    "## 2. Requirements",
    specs.join("\n\n") || "_No requirement changes (skip_specs)._",
    "## 3. Design",
    design || "_Not written yet._",
    "## 4. Tasks",
    tasks || "_Not written yet._",
  ].join("\n\n") + "\n";
}

// Linear escapes brackets when it returns Markdown ("\[backend\]"); undo that before parsing.
const unescape = (md) => md.replace(/\\([[\]_*`#>-])/g, "$1");

// The body under the first heading named `name` (optionally numbered), up to the next heading
// of the same or a higher level.
function section(md, name) {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^#{1,4}\\s*(?:\\d+\\.\\s*)?${name}\\b`, "i").test(l));
  if (start === -1) return "";
  const level = lines[start].match(/^#+/)[0].length;
  const end = lines.findIndex((l, i) => i > start && /^#{1,6}\s/.test(l) && l.match(/^#+/)[0].length <= level);
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n");
}

// One checklist line: "- [ ] 1.1 [repo] text" or "- [x] [repo] 1.1 text" (already unescaped).
function parseTaskLine(line) {
  const box = line.match(/^\s*[-*]\s+\[([^\]]*)\]\s*(.*)$/);
  if (!box) return null;
  const m = box[2].match(/^(?:\[([^\]]+)\]\s*)?(?:(\d+(?:\.\d+)*)\s+)?(?:\[([^\]]+)\]\s*)?(.*)$/);
  return { done: /^\s*[xX]\s*$/.test(box[1]), id: m[2] ?? null, repo: m[1] ?? m[3] ?? null, text: m[4].trim() };
}

// The exact patch that ticks task `id` in RFC content as Linear returns it (escaped brackets
// and all), for save_document's { op: "replace", old_string, new_string }.
export function tickPatch(raw, id) {
  const lines = raw.split("\n").filter((line) => parseTaskLine(unescape(line))?.id === id);
  if (lines.length === 0) throw new Error(`no task ${id} in the RFC`);
  if (lines.length > 1) throw new Error(`task ${id} appears ${lines.length} times in the RFC; tick it by hand`);
  const [line] = lines;
  if (raw.split(line).length !== 2) throw new Error(`the line for task ${id} isn't unique in the RFC; tick it by hand`);
  if (parseTaskLine(unescape(line)).done) return { id, already: true, old_string: line, new_string: line };
  return { id, already: false, old_string: line, new_string: line.replace(/^(\s*[-*]\s+)\[[^\]]*\]/, "$1[x]") };
}

// "." means the current git repository's folder name, which is how tasks are tagged.
function resolveRepo(repo) {
  if (repo !== ".") return repo;
  try {
    return basename(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
  } catch {
    throw new Error("--repo . needs to run inside a git repository; pass the repo name instead");
  }
}

// What /status needs to know about an RFC document.
export function parseRfc(markdown) {
  const md = unescape(markdown ?? "");
  const callGraph = section(md, "Call Graph");
  const tasksText = section(md, "Tasks") || md;
  // Tasks in document order. Accepts "1.1 [repo] text" and "[repo] 1.1 text".
  const tasks = { done: 0, total: 0, byRepo: {}, items: [] };
  let group = null;
  for (const line of tasksText.split("\n")) {
    const heading = line.match(/^#{2,4}\s+(.*\S)\s*$/);
    if (heading) {
      group = heading[1];
      continue;
    }
    const task = parseTaskLine(line);
    if (!task) continue;
    const { done, repo } = task;
    tasks.items.push({ id: task.id ?? String(tasks.items.length + 1), group, repo, text: task.text, done });
    tasks.total += 1;
    tasks.done += done ? 1 : 0;
    if (repo) {
      tasks.byRepo[repo] ??= { done: 0, total: 0 };
      tasks.byRepo[repo].total += 1;
      tasks.byRepo[repo].done += done ? 1 : 0;
    }
  }
  return {
    requirements: (md.match(/^#{2,4}\s*Requirement:/gim) ?? []).length,
    skipSpecs: /No requirement changes \(skip_specs\)/i.test(md),
    scenarios: (md.match(/^(?:#{2,6}\s*|\*\*)Scenario:/gim) ?? []).length,
    callGraph: /```mermaid\b/.test(callGraph) || /^\s*1\.\s+\S/m.test(callGraph),
    tasks,
    verification: parseVerification(md),
  };
}

// "## 5. Verification" holds one line per repo, written by /verify:
//   - [x] archix_cms_backend · passed · 2026-10-22 · scenarios 3/3 · security: no high or critical
//   - [ ] archix_frontend · failed · 2026-10-22 · scenario "Pending review" has no test
// A ticked box means that repo passed.
export const VERIFICATION_HEADING = "## 5. Verification";

function parseVerificationLine(line) {
  const box = line.match(/^\s*[-*]\s+\[([^\]]*)\]\s*(.+)$/);
  if (!box) return null;
  const [repo, ...rest] = box[2].split(" · ").map((part) => part.trim());
  return { repo, passed: /^\s*[xX]\s*$/.test(box[1]), summary: rest.join(" · ") };
}

function parseVerification(md) {
  const byRepo = {};
  for (const line of section(md, "Verification").split("\n")) {
    const entry = parseVerificationLine(line);
    if (entry) byRepo[entry.repo] = { passed: entry.passed, summary: entry.summary };
  }
  return { byRepo };
}

// The save_document patch that records one repo's verify result in RFC content as Linear
// returns it: replace that repo's line, add a line to the section, or append the section.
export function verificationPatch(raw, { repo, passed, summary, date = new Date().toISOString().slice(0, 10) }) {
  const line = `- [${passed ? "x" : " "}] ${repo} · ${passed ? "passed" : "failed"} · ${date} · ${summary}`;
  const lines = raw.split("\n");
  const start = lines.findIndex((l) => /^#{1,4}\s*(?:\d+\.\s*)?Verification\b/i.test(unescape(l)));
  if (start === -1) return { op: "append", text: `\n\n${VERIFICATION_HEADING}\n\n${line}\n`, line };
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.findIndex((l, i) => i > start && /^#{1,6}\s/.test(l) && l.match(/^#+/)[0].length <= level);
  if (end === -1) end = lines.length;
  const body = lines.slice(start + 1, end);
  const existing = body.find((l) => parseVerificationLine(unescape(l))?.repo === repo);
  const unique = (text) => raw.split(text).length === 2;
  if (existing) {
    if (!unique(existing)) throw new Error(`the Verification line for ${repo} isn't unique; update it by hand`);
    return { op: "replace", old_string: existing, new_string: line, line };
  }
  const anchor = [...body].reverse().find((l) => l.trim()) ?? lines[start];
  if (!unique(anchor)) throw new Error("couldn't find a unique place in the Verification section; update it by hand");
  return { op: "insert_after", anchor, text: `\n${line}`, line };
}

// The language code to translate into, or null when it's English (Linear is already English).
function targetLanguage(code) {
  const language = resolveLanguage(code || loadConfig().values["translate.language"]);
  if (!language) throw new Error(`unknown language code "${code}". Run translate.mjs --list-languages.`);
  return /English/.test(language.name) ? null : language;
}

function openWithSystem(target) {
  const [cmd, ...args] =
    process.platform === "darwin" ? ["open", target] : process.platform === "win32" ? ["cmd", "/c", "start", "", target] : ["xdg-open", target];
  const result = spawnSync(cmd, args, { stdio: "ignore" });
  if (result.error || result.status !== 0) throw new Error(`could not open ${target} with ${cmd}`);
}

function copyToClipboard(text) {
  for (const cmd of [["pbcopy"], ["wl-copy"], ["xclip", "-selection", "clipboard"]]) {
    try {
      execFileSync(cmd[0], cmd.slice(1), { input: text, stdio: ["pipe", "ignore", "ignore"] });
      return true;
    } catch {}
  }
  return false;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      title: { type: "string" },
      url: { type: "string" },
      copy: { type: "boolean" },
      lang: { type: "string" },
      en: { type: "boolean" },
      force: { type: "boolean" },
      print: { type: "boolean" },
      repo: { type: "string" },
      json: { type: "boolean" },
    },
  });
  const [command, arg] = positionals;
  if (command === "export") {
    if (!arg) throw new Error('usage: rfc.mjs export <KEY> [--title "..."] [--url ...] [--copy]');
    const key = arg.toUpperCase();
    const change = findChange(key);
    if (!change) throw new Error(`no draft for ${key} in ${changesDir()}. Run /act-sdlc:to-spec ${key} first.`);
    const markdown = buildRfc(change, { key, title: values.title, url: values.url });
    const out = join(workspaceDir(), "rfc", `${key}.md`);
    await mkdir(join(workspaceDir(), "rfc"), { recursive: true });
    await writeFile(out, markdown);
    const copied = values.copy && copyToClipboard(markdown);
    console.log(`${out}${copied ? " (copied to clipboard)" : ""}`);
    console.log(`/act-sdlc:to-spec publishes this as "${RFC_TITLE_PREFIX} ${values.title || change.id}" on ${key}; to do it by hand, paste it into a new issue document with that title.`);
  } else if (command === "sync") {
    if (!arg) throw new Error("usage: rfc.mjs sync <KEY> < rfc.md");
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    if (!text.trim()) throw new Error("no RFC content on stdin");
    const out = rfcPath(arg.toUpperCase());
    const content = `${unescape(text).trim()}\n`;
    const changed = read(out) !== content;
    if (changed) {
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, content);
    }
    console.log(`${changed ? "updated" : "unchanged"}: ${out}`);
  } else if (command === "translate") {
    if (!arg) throw new Error("usage: rfc.mjs translate <KEY> [--lang <code>] [--force]");
    const key = arg.toUpperCase();
    const language = targetLanguage(values.lang);
    if (!language) return console.log(`skipped: your language is English, and ${rfcPath(key)} already is`);
    if (!existsSync(rfcPath(key))) throw new Error(`no RFC for ${key} at ${rfcPath(key)}. Run /act-sdlc:to-spec ${key} or /act-sdlc:open ${key}.`);
    const args = [join(dirname(fileURLToPath(import.meta.url)), "translate.mjs"), "--in", rfcPath(key), "--out", rfcPath(key, language.code), "--lang", language.code];
    if (values.force) args.push("--force");
    const result = spawnSync(process.execPath, args, { stdio: "inherit" });
    process.exitCode = result.status ?? 1;
  } else if (command === "open") {
    if (!arg) throw new Error("usage: rfc.mjs open <KEY> [--en] [--lang <code>] [--print]");
    const key = arg.toUpperCase();
    const language = values.en ? null : targetLanguage(values.lang);
    const file = rfcPath(key, language?.code);
    if (!existsSync(file)) {
      throw new Error(`${file} doesn't exist yet. Run /act-sdlc:open ${key}, which fetches the RFC from Linear and translates it.`);
    }
    if (values.print) process.stdout.write(read(file));
    else {
      openWithSystem(file);
      console.log(`opened ${file}`);
    }
  } else if (command === "open-url") {
    if (!/^https:\/\/linear\.app\//.test(arg ?? "")) throw new Error("usage: rfc.mjs open-url <https://linear.app/...>");
    openWithSystem(arg);
    console.log(`opened ${arg}`);
  } else if (command === "verify-patch") {
    const [, repoArg, result, summary, source] = positionals;
    if (!repoArg || !["pass", "fail"].includes(result) || !summary || !source) {
      throw new Error('usage: rfc.mjs verify-patch <repo|.> <pass|fail> "<summary>" <file|->');
    }
    let text = "";
    if (source === "-") for await (const chunk of process.stdin) text += chunk;
    else text = readFileSync(source, "utf8");
    console.log(JSON.stringify(verificationPatch(text, { repo: resolveRepo(repoArg), passed: result === "pass", summary }), null, 2));
  } else if (command === "tick") {
    const [, id, source] = positionals;
    if (!id || !source) throw new Error("usage: rfc.mjs tick <task id> <file|->");
    let text = "";
    if (source === "-") for await (const chunk of process.stdin) text += chunk;
    else text = readFileSync(source, "utf8");
    console.log(JSON.stringify(tickPatch(text, id), null, 2));
  } else if (command === "tasks") {
    if (!arg) throw new Error("usage: rfc.mjs tasks <file|-> [--repo <name>] [--json]");
    let text = "";
    if (arg === "-") for await (const chunk of process.stdin) text += chunk;
    else text = readFileSync(arg, "utf8");
    const repo = values.repo ? resolveRepo(values.repo) : null;
    const items = parseRfc(text).tasks.items.filter((t) => !repo || t.repo === repo);
    const next = items.find((t) => !t.done) ?? null;
    if (values.json) return console.log(JSON.stringify({ repo, items, next }, null, 2));
    if (repo && items.length === 0) return console.log(`No tasks for ${repo} in this RFC.`);
    let group = undefined;
    for (const t of items) {
      if (t.group !== group) {
        group = t.group;
        if (group) console.log(`\n${group}`);
      }
      const marker = t.done ? "✓" : t === next ? "▶" : "·";
      console.log(`  ${marker} ${t.id.padEnd(5)} ${t.repo ? `[${t.repo}] ` : ""}${t.text.length > 90 ? `${t.text.slice(0, 89)}…` : t.text}`);
    }
    const done = items.filter((t) => t.done).length;
    console.log(`\n${done}/${items.length} done${next ? ` · next: ${next.id}` : " · all done"}`);
  } else if (command === "parse") {
    if (!arg) throw new Error("usage: rfc.mjs parse <file|->");
    let text = "";
    if (arg === "-") for await (const chunk of process.stdin) text += chunk;
    else text = readFileSync(arg, "utf8");
    console.log(JSON.stringify(parseRfc(text), null, 2));
  } else {
    throw new Error("usage: rfc.mjs export|sync|translate|open|open-url|parse ... (see the header of rfc.mjs)");
  }
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(`rfc: ${err.message}`);
    process.exit(1);
  });
}
