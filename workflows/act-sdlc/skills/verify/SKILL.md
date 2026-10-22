---
name: verify
description: Testing phase. Verify one issue's change in the current repository against its RFC in Linear. Map every requirement scenario to a passing test, check the code against the Call Graph, run a code review, and run a security review (the bundled OWASP-based method, deep for sensitive areas, findings proven with exploit tests). Then record pass or fail for this repo in the RFC's Verification section. Needs no external security tool. Use for /act-sdlc:verify, "verify ACT-95", "is this ready to ship", "security review this issue", or when /act-sdlc:status says the next step is verify.
argument-hint: <ISSUE-KEY | linear issue URL> [--repo <name>] [--base <branch>] [--deep]
allowed-tools: Bash Read Write Edit Glob Grep Agent Skill mcp__claude_ai_Linear__get_issue mcp__claude_ai_Linear__get_document mcp__claude_ai_Linear__list_issues mcp__claude_ai_Linear__save_document mcp__linear__get_issue mcp__linear__get_document mcp__linear__list_issues mcp__linear__save_document
---

# Verify an issue's change in this repository

Arguments: `$ARGUMENTS`

This is phase 5 (Testing) in `${CLAUDE_PLUGIN_ROOT}/docs/lifecycle.md`. Run it once the repo's RFC tasks are ticked, in each repository the RFC touches.

Hard rules:
- **Git belongs to the developer.** You may read git (diff, log, merge-base), but never switch branches, stage, commit, stash, push, or reset.
- **Only one thing is written to Linear:** this repo's line in the RFC's `5. Verification` section, through the exact patch from `rfc.mjs verify-patch`. Never change any other text.
- **Exploit tests run locally only**, against the repository's own test setup. Never run them against shared, staging, or production systems.
- **Code changes stay small.** `/verify` may add tests: scenario tests that are missing, and exploit tests. It doesn't fix bugs or vulnerabilities unless the developer asks. It reports them.

Shorthand: `RFC` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs"`.

## 1. Read the issue and its RFC

1. Resolve the key from the argument. A URL contains it in `/issue/<KEY>/`. Uppercase it.
2. Read the issue with `get_issue` (prefix `mcp__claude_ai_Linear__` or `mcp__linear__`), and its sub-issues with `list_issues` and `parentId: <KEY>`.
   - **Sub-issues exist:** it's an umbrella. Verify happens per sub-issue; point to `/act-sdlc:status <KEY>` and stop.
3. Read the `RFC:` document with `get_document`, and keep its `id`. Save the content exactly as returned to `/tmp/act-<KEY>-rfc.md`, then run `RFC sync <KEY> < /tmp/act-<KEY>-rfc.md`.
   - **No RFC:** stop and suggest `/act-sdlc:to-spec <KEY>`.
4. Check this repo's tasks: `RFC tasks /tmp/act-<KEY>-rfc.md --repo <repo>`. `<repo>` is `.` unless `--repo` was passed.
   - **Open tasks remain:** say which. Ask whether to verify anyway. A partial verify must fail unless the open tasks are human tasks that don't affect code.
   - **No tasks for this repo:** say so and ask whether this is the right repo.

## 2. Set the scope

- **Base:** `--base`, otherwise the remote default branch (`git symbolic-ref --short refs/remotes/origin/HEAD`), otherwise `main`.
- **The change** is everything this issue did in this repo, committed or not:
  - `git diff $(git merge-base HEAD <base>)` (includes uncommitted changes);
  - `git status --porcelain` for untracked files.
- If the diff is empty, say so and stop: there's nothing to verify here.
- If the diff clearly holds unrelated work as well, ask the developer which files belong to this issue.

## 3. Requirements: scenarios to tests

- **The RFC has requirements:** for each scenario under `2. Requirements`, find the test that exercises its WHEN and asserts its THEN, then run it. Use the project's normal test command, with only the relevant tests if the suite is large.
  - Record each scenario as **passing**, **failing**, or **missing** (no test).
  - **Missing:** write the test, following the RFC's **Tests:** line in the Call Graph for how to swap dependencies, then run it.
- **The RFC uses `skip_specs`:** there are no scenarios. Instead, re-run every ticked task's `Verify:` for this repo.

A failing or missing scenario **fails the repo**.

## 4. Design: code against the Call Graph

For each Call Graph node this repo implements, check:
- the function or component exists under that name;
- failure handling matches the node table (retry, fallback, or fail, with the named error);
- untrusted input is parsed only at nodes marked `boundary`;
- tests swap dependencies as the **Tests:** line says, without reshaping the graph.

Report each mismatch. A mismatch fails the repo when it changes behavior the RFC relies on. A naming or structural drift only gets a note, plus a suggestion to update the RFC with `/act-sdlc:to-spec <KEY>`.

## 5. Code review

If the `code-review` skill is available, invoke it with the Skill tool on this diff. Otherwise review the diff yourself for correctness bugs.

Bugs that break the RFC's requirements fail the repo. Other findings are listed in the report.

## 6. Security review

Read `${CLAUDE_PLUGIN_ROOT}/docs/security-review.md` and follow it.

1. **Choose the depth.**
   - **Deep:** `--deep` was passed, or the RFC and diff touch a sensitive area listed in the guide, such as auth, authorization, credits or trials, personal data, a public endpoint, a vendor or webhook, LLM prompts built from user content, or migrations that change access.
   - **Standard:** otherwise.
   - Say which depth was chosen, and why.
2. **Model the change:** its trust boundaries, the Call Graph boundary nodes, who is allowed to do what, and where attacker-controlled data flows.
3. **Work the checklist** (OWASP Top 10:2025, plus API Top 10 for APIs) against the diff and its call paths.
4. **Prove each plausible finding** with a local exploit test, as the guide describes. A finding is confirmed, unconfirmed, or ruled out.
5. **Extra tools are optional.**
   - If the built-in `security-review` skill is available, invoke it as a second pass and merge what it finds.
   - If the developer has a dedicated security scanner or pentest tool installed and configured, you may offer to run it for extra evidence.
   - Never require any of these, and never install them.

A critical or high finding, confirmed or unconfirmed, **fails the repo**. Medium and low findings pass, and are listed in the report.

## 7. Record the result in the RFC

1. Decide the result: **pass** only if steps 3 to 6 found nothing that fails the repo.
2. Write a one-line summary, at most about 120 characters, for example:
   - `scenarios 3/3 · call graph ok · security (deep): no high or critical, 1 medium`
   - `scenario "Concurrent requests" fails · security: IDOR on /grants/:id (high)`
3. Get the patch:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs" verify-patch <repo> <pass|fail> "<summary>" /tmp/act-<KEY>-rfc.md
   ```
   It returns one operation: `replace` (this repo's line exists), `insert_after` (add a line to the section), or `append` (create the section).
4. Apply it with `save_document`, passing the RFC document `id` and `patch: [<that operation without the "line" field>]`. Never send `content`.
5. Re-read the document and run `RFC sync <KEY>`.

## 8. Report

- **Scope:** base branch, files reviewed, depth, and why.
- **Requirements:** each scenario as passing, failing, or missing; the tests written now; and whether `skip_specs` applied.
- **Call Graph:** whether it matches; mismatches.
- **Code review:** findings.
- **Security:** each finding with severity, OWASP id, file:line, exploit test, and suggested root-cause fix; plus the checklist coverage, including what couldn't be assessed (A09 usually).
- **Result:** pass or fail, and the line recorded in Linear.
- **Changes `/verify` made:** the test files added. They're uncommitted; git is up to the developer.
- **Next:**
  - **Fail:** fix the findings, then run `/act-sdlc:verify <KEY>` again.
  - **Pass:** run `/act-sdlc:verify` in the other repos with tasks. Once all repos pass, the issue moves to Deployment.

  `/act-sdlc:status <KEY>` shows both.
