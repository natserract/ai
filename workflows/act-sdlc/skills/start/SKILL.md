---
name: start
description: Development phase. Take the next open task for the current repo from the issue's approved RFC in Linear, implement it following the RFC's Call Graph, run its Verify step, and tick it in the RFC checklist. One task per run by default. Never touches git branches or commits. Use for /act-sdlc:start, "start ACT-184", "work on the next task", "implement task 2.2 of ACT-95", or when /act-sdlc:status says the next step is start.
argument-hint: <ISSUE-KEY | linear issue URL> [--task X.Y | --group N | --all] [--repo <name>] [--force]
allowed-tools: Bash Read Write Edit Glob Grep Agent Skill mcp__claude_ai_Linear__get_issue mcp__claude_ai_Linear__get_document mcp__claude_ai_Linear__list_issues mcp__claude_ai_Linear__save_document mcp__linear__get_issue mcp__linear__get_document mcp__linear__list_issues mcp__linear__save_document
---

# Implement the next RFC task

Arguments: `$ARGUMENTS`

This is phase 4 (Development) in `${CLAUDE_PLUGIN_ROOT}/docs/lifecycle.md`. `/start` organizes the work; it doesn't own it. Any other skill can still be used while implementing.

Hard rules:
- **Git belongs to the developer.** Never create, switch, or delete branches. Never stage, commit, stash, push, or reset. Work in whatever branch and working tree you find.
- **Only one thing is written to Linear:** a checkbox tick in the RFC document, through the exact patch from `rfc.mjs tick`. Never change any other text in the RFC, the issue, or other issues.
- **One task per run by default.**

Shorthand: `RFC` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs"`.

## 1. Read the issue and its RFC from Linear

1. Resolve the key from the argument. A URL contains it in `/issue/<KEY>/`. Uppercase it.
2. Read the issue with `get_issue` (prefix `mcp__claude_ai_Linear__` or `mcp__linear__`): `status`, `title`, `documents`, and its sub-issues through `list_issues` with `parentId: <KEY>`.
   - **Sub-issues exist:** it's an umbrella. Don't start it. Run `/act-sdlc:status <KEY>` and point to the next ready sub-issue.
3. Find the document whose title starts with `RFC:`; if there are several, take the most recently updated. Read it with `get_document`, and keep its `id` for ticking.
   - **No RFC:** stop and suggest `/act-sdlc:to-spec <KEY>`.
4. **Approval check.** The status must be `In Progress`, `Ready to be Released`, or `Done/Released`. Otherwise stop: the RFC isn't approved yet, and the next step is review in Linear, then moving it to In Progress. `--force` skips this check; mention that it was skipped.
5. Save the RFC content exactly as returned to `/tmp/act-<KEY>-rfc.md`. Then store the local English copy:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs" sync <KEY> < /tmp/act-<KEY>-rfc.md
   ```

## 2. Pick the task

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs" tasks /tmp/act-<KEY>-rfc.md --repo <repo> --json
```

- `<repo>` is `.`, meaning the current git repository's folder name, unless the user passed `--repo`. If it fails because this isn't a git repository, ask which repo tag to use.
- **Default:** the `next` task, the first open task for this repo in document order.
- **`--task X.Y`:** that task. If it's already ticked, say so and stop.
- **`--group N`:** the open tasks in the group whose heading starts with `N.`, in order.
- **`--all`:** every open task for this repo, in order.
- **No open tasks for this repo:** run `rfc.mjs tasks /tmp/act-<KEY>-rfc.md` without `--repo`. List the repos that still have open tasks, and stop.

## 3. Load context for this task only

From the RFC, gather only what this task needs:
- the Proposal's **Why**, in one or two lines;
- the requirement scenarios the task implements or affects;
- the Design **Decisions** that constrain it;
- the **Call Graph** nodes the task names, with their name, kind, needs, failure handling, and the **Tests:** line.

Treat tasks that are already ticked as done work. Read the code they produced in this repo before writing new code.

## 4. Classify the task

- **Human task:** an interview, a review or sign-off with people, getting access, an outside confirmation, or a decision by a person. Nothing to code.
  1. Ask the developer whether it's done, and for a short note or link as evidence.
  2. **Done:** tick it (step 7). Mention the evidence in the report; don't write it into Linear.
  3. **Not done:** report it as waiting. Then offer the next open task that doesn't depend on it. Tasks later in the same group usually do depend on it.
- **Code task:** continue.

## 5. Implement

- **Follow the Call Graph.** Use the function and type names it gives. Keep the happy path in the main body and failure handling in one place, as the node table says. Parse untrusted input only at boundary nodes. Write tests the way the **Tests:** line says, by swapping dependencies rather than reshaping the graph.
- **Skills.** Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" get start.skills`. If it lists skills, invoke each one with the Skill tool for this task, in the listed order. Implementation skills such as `pstack:tdd` shape the work; review skills such as `code-review` run on the result before verifying. Other skills still trigger on their own, and the developer can invoke any skill at any time.
- **Divergence.** If the task can't be done as the RFC describes, for example because a Call Graph node is wrong or a decision doesn't hold up in the code, stop before going further. Explain the mismatch. The fix is to update the RFC with `/act-sdlc:to-spec <KEY>`, not to drift silently.
- **Who to ask.** When you stop on a divergence or a question the RFC doesn't answer, name the people from the **Ask** column of the affected nodes, plus anyone relevant in **Context & people**. If a node has no Ask entry, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/who.mjs" <file>:<symbol>` and name the top contributor and the date of their last change, never their email.
- **Scope.** Stay inside this task. Note follow-up ideas in the report; don't build them.

## 6. Verify

Run exactly what the task's `Verify:` says: the named tests, command, or observable behavior. Show the result.

- **Passes:** go to step 7.
- **Fails:** don't tick. Report what failed and what was tried, then stop.

## 7. Tick it in Linear

1. Get the exact patch from the Linear content:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs" tick <task id> /tmp/act-<KEY>-rfc.md
   ```
   - It prints `old_string` and `new_string`, the same line with `[x]`.
   - `already: true` means someone already ticked it. Skip the write.
   - If it errors because the line isn't unique or wasn't found, tell the user to tick it by hand in Linear.
2. Apply it with `save_document`, passing the RFC document `id` and `patch: [{ "op": "replace", "old_string": <old_string>, "new_string": <new_string> }]`. Never send `content`, which would overwrite edits other people made.
3. Re-read the document with `get_document`, save it again to `/tmp/act-<KEY>-rfc.md`, then run `rfc.mjs sync <KEY>`. That way the next task, or the next loop step, sees current state, including ticks made by others in the meantime.

## 8. Continue or stop

- **Default (one task):** stop.
- **`--group N`:** move to the group's next open task, and repeat steps 3 to 7. Stop at the first failure, divergence, or unfinished human task.
- **`--all`:** handle each open task with a fresh subagent through the Agent tool, one at a time, in order.
  - Give the subagent: the task, its context from step 3, the repo path, the `start.skills` list, and these hard rules (no git actions, no Linear writes).
  - The subagent implements and verifies, then reports pass or fail.
  - This main thread does the tick (step 7) after each pass, and stops at the first failure.
  - Human tasks still come back to the developer (step 4).

## 9. Report

- The task id and title, and whether it was done, is waiting (human task), failed verify, or stopped on divergence. When stopped, say who to ask, from the Ask column.
- The files changed, and the verify result.
- Whether it was ticked in Linear.
- The current branch, plus a reminder that **changes are uncommitted** and git is up to the developer.
- Progress for this repo: run `rfc.mjs tasks /tmp/act-<KEY>-rfc.md --repo <repo>` and show its output.
- The next step: `/act-sdlc:start <KEY>` for the next task. If this repo is done, name the repos with open tasks. If every task is done, say so: Testing comes next, and `/act-sdlc:status <KEY>` shows it.
