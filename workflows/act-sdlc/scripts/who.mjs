#!/usr/bin/env node
// Who to ask about a piece of code: CODEOWNERS plus the people who wrote it, from git.
// Run inside a repository. A symbol narrows it to that function, method, or class.
//
//   node who.mjs <file>[:<symbol>] [<file>[:<symbol>] ...] [--json]
//
// Emails are in the JSON for matching people to Linear users only. Never put them in an RFC.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const STALE_MONTHS = 18;
const MAX_RANGE = 200;
const BOT = /\[bot\]|dependabot|github-actions|renovate|coderabbit/i;
const SEP = "\x1f";

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The 1-based line range of a symbol's definition, or null.
export function findSymbolRange(lines, symbol) {
  const n = escape(symbol);
  const modifiers = "(?:(?:export|default|public|private|protected|static|async|readonly|override|abstract|declare|get|set)\\s+)*";
  const patterns = [
    new RegExp(`^\\s*${modifiers}function\\s*\\*?\\s*${n}\\b`),
    new RegExp(`^\\s*${modifiers}(?:const|let|var)\\s+${n}\\s*[=:]`),
    new RegExp(`^\\s*${modifiers}(?:class|interface|enum|type)\\s+${n}\\b`),
    new RegExp(`^\\s*(?:async\\s+)?def\\s+${n}\\b`),
    new RegExp(`^func\\s+(?:\\([^)]*\\)\\s*)?${n}\\b`),
    new RegExp(`^\\s*${modifiers}${n}\\s*(?:<[^>]*>)?\\s*\\(`),
  ];
  let start = -1;
  for (const pattern of patterns) {
    start = lines.findIndex((line) => pattern.test(line) && !/;\s*$/.test(line) && !/^\s*(?:return|await|if|for|while|switch)\b/.test(line));
    if (start !== -1) break;
  }
  if (start === -1) return null;

  const indent = lines[start].match(/^\s*/)[0].length;
  const isPython = /^\s*(?:async\s+)?(?:def|class)\s/.test(lines[start]);
  let end = start;
  if (!isPython) {
    // Brace languages: the body opens on the first line ending in "{" (a multi-line signature
    // can hold "= {}" defaults first); follow { } depth from there.
    const bodyOpen = lines.findIndex((line, i) => i >= start && i <= start + 15 && /\{\s*$/.test(line.replace(/\/\/.*$/, "")));
    let depth = 0;
    let opened = false;
    for (let i = bodyOpen === -1 ? start : bodyOpen; i < lines.length && i < start + MAX_RANGE; i++) {
      for (const ch of lines[i].replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "")) {
        if (ch === "{") {
          depth++;
          opened = true;
        } else if (ch === "}") depth--;
      }
      end = i;
      if (opened && depth <= 0) break;
      if (!opened && i > start + 10) break;
    }
    if (opened) return { start: start + 1, end: end + 1 };
  }
  // Indentation languages, or no braces found: up to the next line at the same or lower indent.
  for (end = start + 1; end < lines.length && end < start + MAX_RANGE; end++) {
    const line = lines[end];
    if (line.trim() && line.match(/^\s*/)[0].length <= indent) break;
  }
  return { start: start + 1, end: end };
}

// gitignore-style CODEOWNERS pattern → RegExp over repo-relative paths.
function ownerPattern(pattern) {
  let p = pattern.trim();
  const anchored = p.startsWith("/") || p.replace(/\/$/, "").includes("/");
  p = p.replace(/^\//, "");
  const dir = p.endsWith("/");
  p = p.replace(/\/$/, "");
  const body = p
    .split("**")
    .map((part) => part.split("*").map((s) => s.split("?").map(escape).join("[^/]")).join("[^/]*"))
    .join(".*");
  return new RegExp(`${anchored ? "^" : "(^|/)"}${body}${dir ? "/" : "(/|$)"}`);
}

export function codeowners(root, path) {
  const file = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"].map((f) => join(root, f)).find(existsSync);
  if (!file) return [];
  let owners = [];
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [pattern, ...people] = line.split(/\s+/);
    if (ownerPattern(pattern).test(path)) owners = people;
  }
  return owners;
}

const githubLogin = (email) => email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i)?.[1] ?? null;

function monthsAgo(date) {
  const then = new Date(date);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

function logCommits(root, path, range) {
  const format = `--format=${["%H", "%an", "%ae", "%ad", "%s"].join("%x1f")}`;
  const args = range
    ? ["log", "-L", `${range.start},${range.end}:${path}`, "--no-patch", format, "--date=short"]
    : ["log", format, "--date=short", "--", path];
  return git(args, root)
    .split("\n")
    .filter((line) => line.includes(SEP))
    .map((line) => {
      const [sha, name, email, date, subject] = line.split(SEP);
      return { sha, name, email: email.toLowerCase(), date, subject };
    });
}

function blameLines(root, path, range) {
  const args = ["blame", "--line-porcelain", ...(range ? ["-L", `${range.start},${range.end}`] : []), "--", path];
  const counts = new Map();
  let name = null;
  for (const line of git(args, root).split("\n")) {
    if (line.startsWith("author ")) name = line.slice(7);
    else if (line.startsWith("author-mail ")) {
      const email = line.slice(12).replace(/[<>]/g, "").toLowerCase();
      const entry = counts.get(email) ?? { name, lines: 0 };
      entry.lines += 1;
      counts.set(email, entry);
    }
  }
  return counts;
}

export function who(target, cwd = process.cwd()) {
  const [fileArg, symbol = null] = target.split(/:(?=[^/\\]+$)/);
  let root;
  try {
    root = git(["rev-parse", "--show-toplevel"], cwd).trim();
  } catch {
    throw new Error(`${cwd} isn't inside a git repository; run who.mjs from the repo that holds ${fileArg}`);
  }
  const abs = resolve(cwd, fileArg);
  if (!existsSync(abs)) throw new Error(`${fileArg} doesn't exist`);
  const path = relative(realpathSync(root), realpathSync(abs));
  const range = symbol ? findSymbolRange(readFileSync(abs, "utf8").split("\n"), symbol) : null;

  const commits = logCommits(root, path, range);
  const blame = blameLines(root, path, range);
  const people = new Map();
  for (const [email, { name, lines }] of blame) people.set(email, { name, email, lines, commits: 0, lastChange: null });
  for (const c of commits) {
    const p = people.get(c.email) ?? { name: c.name, email: c.email, lines: 0, commits: 0, lastChange: null };
    p.commits += 1;
    if (!p.lastChange || c.date > p.lastChange) p.lastChange = c.date;
    people.set(c.email, p);
  }
  const contributors = [...people.values()]
    .filter((p) => !BOT.test(p.name ?? "") && !BOT.test(p.email))
    .map((p) => ({ ...p, githubLogin: githubLogin(p.email), stale: p.lastChange ? monthsAgo(p.lastChange) > STALE_MONTHS : true }))
    .sort((a, b) => b.lines - a.lines || b.commits - a.commits);

  return {
    repo: root.split("/").pop(),
    file: path,
    symbol,
    symbolFound: symbol ? Boolean(range) : null,
    range,
    codeowners: codeowners(root, path),
    contributors,
    lastChange: commits[0]?.date ?? null,
    recentCommits: commits.slice(0, 5).map((c) => ({
      sha: c.sha.slice(0, 10),
      date: c.date,
      author: c.name,
      subject: c.subject,
      prs: [...c.subject.matchAll(/#(\d+)/g)].map((m) => Number(m[1])),
    })),
  };
}

function render(r) {
  const where = r.symbol ? `${r.file}:${r.symbol}${r.range ? ` (lines ${r.range.start}-${r.range.end})` : " (symbol not found, whole file)"}` : r.file;
  const total = r.contributors.reduce((sum, c) => sum + c.lines, 0) || 1;
  const lines = [`${where}  · ${r.repo}`, `  CODEOWNERS: ${r.codeowners.length ? r.codeowners.join(" ") : "none"}`];
  r.contributors.slice(0, 3).forEach((c, i) => {
    const handle = c.githubLogin ? ` @${c.githubLogin}` : "";
    lines.push(`  ${i === 0 ? "Ask" : "   "} ${c.name}${handle} · ${Math.round((c.lines / total) * 100)}% of lines, ${c.commits} commits, last ${c.lastChange ?? "?"}${c.stale ? " (stale)" : ""}`);
  });
  if (!r.contributors.length) lines.push("  No human contributors found");
  for (const c of r.recentCommits.slice(0, 3)) lines.push(`  ${c.sha.slice(0, 7)} ${c.date} ${c.author}: ${c.subject}`);
  return lines.join("\n");
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { json: { type: "boolean" } } });
  if (!positionals.length) throw new Error("usage: who.mjs <file>[:<symbol>] [...] [--json]");
  const results = positionals.map((t) => who(t));
  console.log(values.json ? JSON.stringify(results, null, 2) : results.map(render).join("\n\n"));
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(`who: ${err.message.split("\n")[0]}`);
    process.exit(1);
  });
}
