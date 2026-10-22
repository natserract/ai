---
name: to-spec
description: Draft the RFC for a Linear issue, covering the Analysis and Design phases (proposal, requirements with scenarios, design with a Call Graph, and repo-tagged tasks), validated with OpenSpec in the local workspace, then published to the Linear issue as an "RFC: <title>" document plus a short notification comment. Use for /act-sdlc:to-spec, "write the RFC for ACT-95", "spec this issue", or when /act-sdlc:status says the next step is to-spec.
argument-hint: <ISSUE-KEY | linear issue URL> [--no-publish]
allowed-tools: Bash(node:*) Read Write Edit Glob Grep mcp__claude_ai_Linear__get_issue mcp__claude_ai_Linear__list_comments mcp__claude_ai_Linear__get_document mcp__linear__get_issue mcp__linear__list_comments mcp__linear__get_document mcp__claude_ai_Linear__save_document mcp__claude_ai_Linear__save_comment mcp__linear__save_document mcp__linear__save_comment Bash(gh:*) mcp__claude_ai_Linear__list_users mcp__claude_ai_Linear__list_issues mcp__linear__list_users mcp__linear__list_issues Bash(git remote:*)
---

# Draft the RFC for a Linear issue

Arguments: `$ARGUMENTS`

This command covers phases 2 (Analysis) and 3 (Design) in `${CLAUDE_PLUGIN_ROOT}/docs/lifecycle.md`.

**Where things live:**
- The draft is an OpenSpec change in the developer's local workspace, `~/.act/openspec/changes/<id>/`, outside every repo.
- The shared copy is a document titled `RFC: <issue title>` on the Linear issue.

**What act-sdlc writes to Linear:** only the issue's `RFC:` document and one notification comment per publish (step 7). Never change the issue's status, labels, assignee, title, or description, and never edit or delete anyone's comments. People move the status themselves.

Shorthand used below:
- `OPENSPEC` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/openspec.mjs"` (always runs in the workspace)
- `PHASES` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/phases.mjs"`
- `RFC` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs"`

## 1. Read the issue

1. Resolve the key from the argument. A URL contains it in `/issue/<KEY>/`. Uppercase it.
2. Read the issue with the Linear MCP tools (prefix `mcp__claude_ai_Linear__` or `mcp__linear__`):
   - `get_issue` with `documents`
   - `list_comments`, because comments often hold the real plan
   - `get_document` for any document whose title starts with `RFC:`
   If Linear isn't connected, tell the user to connect it in claude.ai connector settings or with `/mcp`, and stop.
3. **If an `RFC:` document already exists, treat it as the source of truth.** People may have edited it in Linear. Ask the user whether to draft a revision of it. A revision starts from the Linear content, not from an older local draft.
4. If `~/.act/issues/<KEY>.*.md` exists, read it as well. It's a translation, useful for wording only.
5. Links to other tools, such as a Notion RFC, can't be read unless that tool is connected. Mention them, and ask the user to paste the key points if they matter.

## 2. Find or create the draft

1. If `~/.act/openspec/` is missing, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" init`.
2. Run `PHASES status <KEY> --json`. If `draft` is set, **continue that draft**: keep what's written and fill in what's missing.
3. Otherwise, get the id with `PHASES change-id <KEY> "<gitBranchName or title>"`, then create the draft with `OPENSPEC new change <id> --description "<title>"`.

The draft lives in a hidden folder that file searches may skip, so read and write its files by exact path.

## 3. Decide the path

- Get the light-path labels with `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" get phases.lightLabels`. If the issue has one, use the **light path**:
  - keep the proposal short;
  - the design is one or two lines saying why no design is needed;
  - the Call Graph is numbered steps.
- Check whether Call Graphs are required with `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" get phases.callGraph`. They are by default.
- **No observable behavior change** (a refactor, tooling, or a pure audit): set `skip_specs: true` in the draft's `.openspec.yaml` instead of inventing requirements.
- **Very large issues:** if the issue holds several independently shippable stages, such as ACT-95's six steps, propose covering the first coherent stages in this RFC and splitting the rest into follow-up issues. The user creates those issues.

## 4. Find the code, across repos

One RFC can span several repositories, for example backend, frontend, and AI Service.
- Start from the current directory's repo.
- Ask the user which other local repos are involved. Read their code by path so names in the design and tasks are real.
- Use each repository's folder name as its tag, for example `[archix_cms_backend]`.

## 4a. Find the people and context

This feeds the Call Graph's **Ask** column and the **Context & people** section (see `${CLAUDE_PLUGIN_ROOT}/docs/call-graph.md`). Use real data only, and never write an email address into the RFC.

1. **Who wrote the code.** For each existing function or component the change touches, run this from inside its repository:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/who.mjs" <file>:<symbol> [<file>:<symbol> ...] --json
   ```
   It returns CODEOWNERS, contributors ranked by lines in that symbol (with commits, last change, and `stale`), and recent commits with their PR numbers. If a symbol isn't found, it falls back to the whole file.
2. **Linear names.** Look up each contributor's email with `list_users(query: <email>)`, once per email, and use their `@displayName`. If there's no match, use the GitHub login: from `githubLogin`, or from the PR author in step 3.
3. **PRs.** For each PR number in the recent commits, run `gh pr view <n> --repo <owner>/<repo> --json number,title,author,mergedAt,url`. Get `<owner>/<repo>` from `git remote get-url origin`. Keep the 3 to 5 most recent across the touched code.
4. **Related issues.** Collect them from:
   - Linear keys in those PRs' titles and branch names;
   - the current issue's relations and comments;
   - a `list_issues` search on the feature's 2 or 3 key terms, keeping the most relevant.

   For each related issue, read its `RFC:` document title, and note any decision this RFC must respect.
5. **Domain people:** the CODEOWNERS owners, the issue's reporter, and people who made decisions in its comments or Slack threads.

Record the date you gathered this; it goes into the section.

## 5. Write the artifacts in order

The order is proposal, then specs and design, then tasks. For each artifact:

1. Run `OPENSPEC instructions <artifact> --change <id> --json`. Follow its `instruction` and `template`, and apply the workspace `rules` it returns.
2. Write the file at its `outputPath` inside `~/.act/openspec/changes/<id>/`.

Rules from our workflow:
- **Proposal:** starts with `Linear: [<KEY>](<issue url>)` and keeps the issue's "why" in the team's own words.
- **Specs:** each item in the issue's acceptance criteria becomes a scenario with **WHEN**/**THEN**. Process criteria ("the RFC is approved") go into tasks instead.
- **Design:** records decisions with alternatives. Questions that would change the specs or tasks are asked now, not written down as open questions.
- **Call Graph:** when `phases.callGraph` is true, read `${CLAUDE_PLUGIN_ROOT}/docs/call-graph.md` first. Then add a `## Call Graph` section to the design:
  - a Mermaid flowchart plus node table by default;
  - a sequence diagram when the flow crosses services or repos;
  - numbered steps on the light path;
  - real function names, and a **Tests:** line at the end.
  - an **Ask** column from step 4a: who to ask for existing nodes, `owner of task X.Y` for new ones;
  - a **`### Context & people`** section right after the Call Graph, from step 4a, with sources and the as-of date.
  Run through the guide's reviewer checklist.
- **Tasks:** use `- [ ] [<repo>] N.M ...`, derived from the Call Graph nodes, leaves first. Each task says how to verify it.

## 6. Validate and export

1. Run `OPENSPEC validate <id> --strict --json`. Fix every error and run it again, for at most 3 rounds. If errors remain, show them and stop.
2. Export the single RFC document:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs" export <KEY> --title "<issue title>" --url "<issue url>"
   ```
   The file is `~/.act/rfc/<KEY>.md`. Linear turns its ` ```mermaid ` block into a diagram and its `- [ ]` lines into a checklist.

## 7. Publish to Linear

Skip this step, and say so, if the user passed `--no-publish` or `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" get rfc.publish` prints `false`. In that case, tell the user they can paste `~/.act/rfc/<KEY>.md` into the issue themselves.

Otherwise publish without asking. The team chose this, and the document keeps every earlier version.

1. **The document.** Read `~/.act/rfc/<KEY>.md` and use its full text as the content, unescaped.
   - **No `RFC:` document on the issue yet** (from step 1): create one with `save_document`, passing `issue: "<KEY>"`, `title: "RFC: <issue title>"`, and the content.
   - **An `RFC:` document exists:** update it with `save_document`, passing its `id` and the full new content. Linear keeps the previous version in the document's history. Before writing, compare the old and new content, and keep a 3 to 5 bullet summary of what changed for the comment and the report.
     - If the existing document has ticked tasks (`- [x]`), keep those ticks for tasks that still exist in the new version, so nobody's progress is lost.
     - If the existing document has a `5. Verification` section, written by `/act-sdlc:verify`, copy it unchanged to the end of the new content. If the revision changes requirements or design, add `(re-verify: RFC revised <date>)` to each of its lines, so the team knows the results predate the change.
2. **The comment.** Add one new top-level comment on the issue with `save_comment` (`issueId: "<KEY>"`). Keep it short:
   - New RFC:
     `RFC drafted with act-sdlc: <document link>` + the requirement and scenario counts + tasks per repo + "Review it and move the issue to RFC, then to In Progress when approved."
   - Revision:
     `RFC updated with act-sdlc: <document link>` + the change bullets.

If a Linear write fails, show the error. Leave `~/.act/rfc/<KEY>.md` as the fallback the user can paste by hand, and don't retry more than once.

## 8. Translate for yourself (local only)

Linear always gets the English RFC. The translation into the developer's default language (`translate.language`) is **local only: never put it in the Linear document or in a comment.** Run this whether or not publishing happened:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs" translate <KEY>
```

- It writes `~/.act/rfc/<KEY>.<lang>.md`.
- It prints `skipped:` when the default language is English, and `current:` when nothing changed.
- If it fails, for example because the API key is missing, mention it with `/act-sdlc:setup`. Don't fail the whole command: the RFC itself is done.

## 9. Report

- The Linear document link, and whether it was created or updated (or that publishing was skipped).
- The requirement and scenario counts, the Call Graph format and node count, and tasks per repo.
- Whether the light path or `skip_specs` was used.
- The local translation path, or why it was skipped. `/act-sdlc:open <KEY>` opens it, and `--en` opens the English copy.
- What people do next in Linear:
  1. Review the RFC, commenting inline in the document.
  2. Move the issue to **RFC** while it's in review.
  3. Move it to **In Progress** once it's approved.
  4. Tick the RFC's checklist as tasks are done.

Suggest `/act-sdlc:status <KEY>` to see the gates.
