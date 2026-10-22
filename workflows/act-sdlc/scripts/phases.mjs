#!/usr/bin/env node
// The 7 SDLC phases as data, and where an issue currently stands.
//
// Evidence: the Linear issue and its "RFC: …" document (read only, passed in as JSON because
// scripts can't call MCP), plus the developer's local draft in ~/.act/openspec/. Linear is the
// shared source of truth: people paste the RFC there, tick its tasks, and move the status.
// An issue is in the first phase whose exit gate isn't met. A gate is true, false, or null;
// null never blocks, and its gate's `nullNote` says why.
//
//   node phases.mjs status <KEY> [--linear-json <file|->] [--json]
//   node phases.mjs status                          one line per local draft
//   node phases.mjs change-id <KEY> <title|branch>  the OpenSpec change id for an issue
//
// --linear-json shape: { status, labels, description, title, gitBranchName,
//                        rfc: { title, content, url } | null,
//                        plan: { title, url } | null,
//                        children: [{ key, title, status, labels, blockedBy: [KEY] }] }
// An issue that /plan split into sub-issues is an umbrella: it doesn't go through the phases
// itself; its sub-issues do, and it's done when they all are.

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadConfig, workspaceDir } from "./config.mjs";
import { runOpenspec } from "./openspec.mjs";
import { findChange, parseRfc } from "./rfc.mjs";

const RELEASED = "Done/Released";
const APPROVED = ["In Progress", "Ready to be Released", RELEASED];

export const PHASES = [
  {
    id: "planning",
    name: "Planning",
    roles: "Everyone",
    linearStatuses: ["Backlog", "Todo"],
    gates: [
      { label: "Issue has a description", check: (c) => (c.linear ? Boolean(c.linear.description?.trim()) : Boolean(c.draft)) },
      { label: "Issue has acceptance criteria", check: (c) => (c.linear ? /acceptance criteria/i.test(c.linear.description ?? "") : Boolean(c.draft)) },
    ],
    next: (c) => `/act-sdlc:plan ${c.key} to triage it. It needs an "Acceptance criteria" section in its description before /act-sdlc:to-spec.`,
  },
  {
    id: "analysis",
    name: "Analysis",
    roles: "Product Owner, Project Manager, Business Analyst, CTO",
    linearStatuses: ["Todo", "RFC"],
    gates: [
      {
        label: (c) => (c.rfc?.skipSpecs || c.draft?.skipSpecs ? "No requirement changes (skip_specs)" : "Requirements with scenarios written"),
        check: (c) =>
          c.rfc ? (c.rfc.requirements > 0 && c.rfc.scenarios > 0) || c.rfc.skipSpecs : Boolean(c.draft?.hasSpecs || c.draft?.skipSpecs),
      },
      {
        label: "Local draft passes openspec validate --strict",
        nullNote: "no local draft",
        check: (c) => (c.draft ? c.draft.valid : null),
      },
    ],
    next: (c) => `/act-sdlc:to-spec ${c.key}`,
  },
  {
    id: "design",
    name: "Design",
    roles: "System Architect, UX/UI Designer",
    linearStatuses: ["RFC"],
    gates: [
      { label: "RFC document on the Linear issue", check: (c) => Boolean(c.rfc) },
      {
        label: (c) =>
          !c.callGraph ? "Call Graph (not required)"
          : c.light ? "Call Graph (light path: numbered steps are enough)"
          : "RFC has a Call Graph (docs/call-graph.md)",
        check: (c) => !c.callGraph || c.light || Boolean(c.rfc?.callGraph),
      },
      { label: "RFC has a task checklist", check: (c) => (c.rfc?.tasks.total ?? 0) > 0 },
      { label: `RFC approved (Linear moved to ${APPROVED[0]} or later)`, check: (c) => APPROVED.includes(c.linear?.status) },
    ],
    next: (c) => {
      if (!c.rfc && c.draft) return `Publish the draft: /act-sdlc:to-spec ${c.key} (creates the RFC document on the issue), or paste ~/.act/rfc/${c.key}.md by hand.`;
      if (!c.rfc) return `/act-sdlc:to-spec ${c.key}`;
      if (!(c.rfc.tasks.total > 0) || (c.callGraph && !c.light && !c.rfc.callGraph)) return `Complete the RFC: /act-sdlc:to-spec ${c.key}, then paste the new version into the Linear document.`;
      return `Review the RFC in Linear; when it's approved, move ${c.key} to ${APPROVED[0]}.`;
    },
  },
  {
    id: "development",
    name: "Development",
    roles: "Front-end Developer, Back-end Developer",
    linearStatuses: ["In Progress"],
    gates: [{ label: "All RFC tasks ticked in Linear", check: (c) => c.rfc?.tasks.total > 0 && c.rfc.tasks.done === c.rfc.tasks.total }],
    next: (c) => `/act-sdlc:start ${c.key} in each repo with open tasks (${c.rfc?.tasks.done ?? 0}/${c.rfc?.tasks.total ?? 0} done).`,
  },
  {
    id: "testing",
    name: "Testing",
    roles: "Solutions Architect, QA Engineer, Tester, DevOps",
    linearStatuses: ["In Progress"],
    gates: [
      {
        label: (c) => {
          const repos = verifyRepos(c);
          const passed = repos.filter((r) => c.rfc?.verification.byRepo[r]?.passed);
          return `Verified with /act-sdlc:verify in every repo (${passed.length}/${repos.length || 1})`;
        },
        check: (c) => {
          const byRepo = c.rfc?.verification.byRepo ?? {};
          const repos = verifyRepos(c);
          return repos.length ? repos.every((r) => byRepo[r]?.passed) : Object.values(byRepo).some((v) => v.passed);
        },
      },
    ],
    next: (c) => {
      const byRepo = c.rfc?.verification.byRepo ?? {};
      const failed = Object.entries(byRepo).filter(([, v]) => !v.passed).map(([r]) => r);
      const missing = verifyRepos(c).filter((r) => !byRepo[r]);
      if (failed.length) return `Fix what /act-sdlc:verify found in ${failed.join(", ")}, then run it again there.`;
      return `/act-sdlc:verify ${c.key} in ${missing.length ? missing.join(", ") : "each repo"}.`;
    },
  },
  {
    id: "deployment",
    name: "Deployment",
    roles: "Data Administrator, DevOps",
    linearStatuses: ["Ready to be Released"],
    gates: [{ label: `Released (Linear: ${RELEASED})`, check: (c) => c.linear?.status === RELEASED }],
    next: (c) => `Release ${c.key}, then move it to ${RELEASED} in Linear.`,
  },
  {
    id: "maintenance",
    name: "Maintenance",
    roles: "Users, Testers, Support Managers",
    linearStatuses: [RELEASED],
    gates: [],
    next: (c) => `Released. Bugs found in production go back to Planning as new issues that link ${c.key}'s RFC.`,
  },
];

// The repos that must pass /verify: every repo that has tasks in the RFC.
const verifyRepos = (c) => Object.keys(c.rfc?.tasks.byRepo ?? {});

// OpenSpec change ids are lowercase kebab-case. Prefer the Linear branch slug
// ("alf/act-130-database-structure-audit"), else slug the key and title.
export function changeId(key, titleOrBranch) {
  const tail = titleOrBranch.includes("/") ? titleOrBranch.split("/").pop() : titleOrBranch;
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const base = slug(tail);
  const k = slug(key);
  return base.startsWith(`${k}-`) || base === k ? base : `${k}-${base}`.replace(/-+$/, "");
}

async function readDraft(key) {
  const found = findChange(key);
  if (!found) return null;
  const specsDir = join(found.dir, "specs");
  const hasSpecs = existsSync(specsDir) && readdirSync(specsDir, { recursive: true }).some((f) => String(f).endsWith(".md"));
  const meta = join(found.dir, ".openspec.yaml");
  const skipSpecs = existsSync(meta) && /^\s*skip_specs:\s*true\b/m.test(readFileSync(meta, "utf8"));
  const { data } = await runOpenspec(["validate", found.id, "--strict", "--json"]);
  const item = data.items?.find((i) => i.id === found.id);
  return {
    ...found,
    hasSpecs,
    skipSpecs,
    valid: item?.valid ?? false,
    issues: (item?.issues ?? []).filter((i) => i.level === "ERROR").map((i) => i.message),
  };
}

export async function collectContext({ key, linear = null, lightLabels = [], callGraph = true }) {
  const labels = (linear?.labels ?? []).map((l) => (typeof l === "string" ? l : l.name));
  return {
    key: key.toUpperCase(),
    linear,
    rfc: linear?.rfc?.content ? { ...parseRfc(linear.rfc.content), title: linear.rfc.title, url: linear.rfc.url } : null,
    draft: await readDraft(key),
    light: labels.some((l) => lightLabels.includes(l)),
    callGraph,
  };
}

const CLOSED = [RELEASED, "Canceled", "Duplicate"];

// An umbrella issue's progress is its sub-issues'. The next one to pick up is the first open
// sub-issue whose blockers are all closed.
export function evaluateUmbrella(ctx) {
  const children = ctx.linear.children;
  const closed = new Set(children.filter((c) => CLOSED.includes(c.status)).map((c) => c.key));
  const open = children.filter((c) => !closed.has(c.key));
  const ready = open.filter((c) => (c.blockedBy ?? []).every((b) => closed.has(b) || !children.some((x) => x.key === b)));
  const next = ready[0];
  return {
    key: ctx.key,
    umbrella: true,
    plan: ctx.linear.plan ?? null,
    complete: open.length === 0,
    children: children.map((c) => ({
      ...c,
      state: closed.has(c.key) ? "closed" : ready.includes(c) ? "ready" : "blocked",
      kind: (c.labels ?? []).map((l) => (typeof l === "string" ? l : l.name)).includes("RFC") ? "decision" : "work",
    })),
    linearStatus: ctx.linear.status ?? null,
    next: open.length === 0
      ? `All sub-issues are closed. Move ${ctx.key} to ${RELEASED} in Linear.`
      : next
        ? `/act-sdlc:status ${next.key} (${next.title}), then /act-sdlc:to-spec ${next.key} if it has no RFC yet.`
        : "Every open sub-issue is blocked by another open one. Check the blocking order in the Plan.",
  };
}

export function evaluate(ctx) {
  if (ctx.linear?.children?.length) return evaluateUmbrella(ctx);
  const results = PHASES.map((phase) => {
    const gates = phase.gates.map((g) => ({
      label: typeof g.label === "function" ? g.label(ctx) : g.label,
      ok: g.check(ctx),
      note: g.nullNote ?? null,
    }));
    return { phase, gates, passed: gates.every((g) => g.ok !== false) };
  });
  const currentIndex = results.findIndex((r) => !r.passed);
  const complete = currentIndex === -1;
  const index = complete ? PHASES.length - 1 : currentIndex;
  const current = results[index];
  const linearStatus = ctx.linear?.status ?? null;
  return {
    key: ctx.key,
    rfc: ctx.rfc ? { title: ctx.rfc.title, url: ctx.rfc.url } : null,
    draft: ctx.draft ? { id: ctx.draft.id, dir: ctx.draft.dir } : null,
    light: ctx.light,
    complete,
    phase: { index: index + 1, id: current.phase.id, name: current.phase.name, roles: current.phase.roles },
    phases: results.map((r, i) => {
      const untracked = r.gates.length > 0 && r.gates.every((g) => g.ok === null);
      const state = i === index && !complete ? "current" : i <= index ? (untracked ? "untracked" : "done") : "todo";
      return { id: r.phase.id, name: r.phase.name, state };
    }),
    gates: current.gates,
    validationErrors: ctx.draft?.issues ?? [],
    tasks: ctx.rfc?.tasks ?? null,
    linearStatus,
    expectedLinearStatuses: current.phase.linearStatuses,
    statusMismatch: linearStatus !== null && !current.phase.linearStatuses.includes(linearStatus),
    next: current.phase.next(ctx),
    warnings: ctx.draft?.duplicates?.length ? [`more than one draft matches ${ctx.key}: ${[ctx.draft.id, ...ctx.draft.duplicates].join(", ")}`] : [],
  };
}

function renderUmbrella(r) {
  const mark = { closed: "✓", ready: "▶", blocked: "·" };
  const done = r.children.filter((c) => c.state === "closed").length;
  const lines = [
    `${r.key}  (split into ${r.children.length} sub-issues${r.plan ? ` · ${r.plan.title}` : ""})`,
    "",
    `Sub-issues: ${done}/${r.children.length} closed`,
    ...r.children.map((c) => {
      const blockers = (c.blockedBy ?? []).filter((b) => r.children.some((x) => x.key === b && x.state !== "closed"));
      return `  ${mark[c.state]} ${c.key.padEnd(9)} ${(c.kind === "decision" ? "[decision] " : "") + c.title}  · ${c.status}${blockers.length ? `  (blocked by ${blockers.join(", ")})` : ""}`;
    }),
    "",
    `Next: ${r.next}`,
  ];
  return lines.join("\n");
}

function render(r) {
  if (r.umbrella) return renderUmbrella(r);
  const mark = { done: "✓", current: "▶", todo: "·", untracked: "○" };
  const where = [r.rfc ? `RFC in Linear: ${r.rfc.title}` : "no RFC in Linear", r.draft ? `draft: ${r.draft.id}` : null].filter(Boolean).join(" · ");
  const lines = [
    `${r.key}  (${where})${r.light ? "  [light path]" : ""}`,
    r.phases.map((p) => `${mark[p.state]} ${p.name}`).join("  →  "),
    "",
    `Phase ${r.phase.index}/7: ${r.phase.name}${r.complete ? " (complete)" : ""}  ·  ${r.phase.roles}`,
    ...r.gates.map((g) => `  ${g.ok === true ? "[x]" : g.ok === false ? "[ ]" : "[–]"} ${g.label}${g.ok === null && g.note ? ` (${g.note})` : ""}`),
  ];
  if (r.tasks?.total) {
    lines.push("", `Tasks: ${r.tasks.done}/${r.tasks.total}`);
    for (const [repo, t] of Object.entries(r.tasks.byRepo)) lines.push(`  ${repo.padEnd(28)} ${t.done}/${t.total}`);
    const nextTask = r.tasks.items?.find((t) => !t.done);
    if (nextTask) lines.push(`  next task: ${nextTask.id} ${nextTask.repo ? `[${nextTask.repo}] ` : ""}${nextTask.text.slice(0, 80)}${nextTask.text.length > 80 ? "…" : ""}`);
  }
  if (r.validationErrors.length) lines.push("", "Draft validation errors:", ...r.validationErrors.map((e) => `  - ${e}`));
  if (r.linearStatus) {
    lines.push("", `Linear status: ${r.linearStatus}${r.statusMismatch ? `  ⚠ expected ${r.expectedLinearStatuses.join(" or ")} for this phase` : ""}`);
  } else {
    lines.push("", `Expected Linear status: ${r.expectedLinearStatuses.join(" or ")}`);
  }
  lines.push(`Next: ${r.next}`);
  for (const w of r.warnings) lines.push(`warning: ${w}`);
  return lines.join("\n");
}

async function readLinear(source) {
  if (!source) return null;
  let text = "";
  if (source === "-") for await (const chunk of process.stdin) text += chunk;
  else text = readFileSync(source, "utf8");
  return JSON.parse(text);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { "linear-json": { type: "string" }, json: { type: "boolean" } },
  });
  const [command, key, extra] = positionals;
  if (command === "change-id") {
    if (!key || !extra) throw new Error("usage: phases.mjs change-id <KEY> <title|gitBranchName>");
    console.log(changeId(key, extra));
    return;
  }
  if (command !== "status") throw new Error("usage: phases.mjs status [KEY] [--linear-json <file|->] [--json]");

  const config = loadConfig();
  const lightLabels = config.values["phases.lightLabels"].split(",").map((s) => s.trim()).filter(Boolean);
  const callGraph = config.values["phases.callGraph"];

  if (key) {
    const ctx = await collectContext({ key, linear: await readLinear(values["linear-json"]), lightLabels, callGraph });
    const result = evaluate(ctx);
    console.log(values.json ? JSON.stringify(result, null, 2) : render(result));
    return;
  }

  // No key: list the local drafts. The phase needs Linear, so it's shown per key.
  const changes = join(workspaceDir(), "openspec", "changes");
  const ids = existsSync(changes) ? readdirSync(changes, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "archive").map((d) => d.name) : [];
  if (values.json) return console.log(JSON.stringify(ids, null, 2));
  if (!ids.length) return console.log(`No drafts in ${changes}. Start one with /act-sdlc:to-spec <KEY>.`);
  console.log("Local drafts (run /act-sdlc:status <KEY> for the phase, which needs Linear):");
  for (const id of ids) console.log(`  ${(id.match(/^([a-z]+-\d+)/)?.[1] ?? "?").toUpperCase().padEnd(10)} ${id}`);
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(`phases: ${err.message}`);
    process.exit(1);
  });
}
