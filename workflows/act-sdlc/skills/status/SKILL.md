---
name: status
description: Show which of the 7 SDLC phases (Planning, Analysis, Design, Development, Testing, Deployment, Maintenance) a Linear issue is in, using the issue and its RFC document in Linear plus the local draft. Shows exit gates, task progress per repo, whether the Linear status matches, and the next step. Without a key, lists the local drafts. Use for /act-sdlc:status, "where is ACT-95", "what's next for this issue", or "how far are the RFC tasks".
argument-hint: "[ISSUE-KEY | linear issue URL]"
allowed-tools: Bash(node:*) Write mcp__claude_ai_Linear__get_issue mcp__claude_ai_Linear__get_document mcp__claude_ai_Linear__list_issues mcp__linear__get_issue mcp__linear__get_document mcp__linear__list_issues
---

# Where is this issue in the lifecycle?

Arguments: `$ARGUMENTS`

The phases and their exit gates are defined in `${CLAUDE_PLUGIN_ROOT}/scripts/phases.mjs`, and explained in `${CLAUDE_PLUGIN_ROOT}/docs/lifecycle.md`. This command only reads Linear: never create or update anything there.

## With an issue key or URL

1. Resolve the key. A URL contains it in `/issue/<KEY>/`. Uppercase it.
2. Read the issue with `get_issue` (prefix `mcp__claude_ai_Linear__` or `mcp__linear__`), with fields `status`, `labels`, `description`, `title`, `gitBranchName`, and `documents`.
3. If a document's title starts with `RFC:`, read it with `get_document`. If there are several, use the most recently updated one. Note any document whose title starts with `Plan:`; you need its title and URL, not its content.
4. List its sub-issues with `list_issues` filtered by `parentId: <KEY>`. For each, keep its key, title, status, labels, and the keys of the issues that block it. Read relations with `get_issue` if the list doesn't include them.
   - **If it has sub-issues, it's an umbrella** that `/act-sdlc:plan` split. The script then shows progress across the sub-issues instead of phases.
5. Write the issue as JSON to a temp file, then run the script. A file avoids quoting problems with long descriptions:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/phases.mjs" status <KEY> --linear-json /tmp/act-<KEY>.json
   ```

   The file's shape:

   ```json
   {"status": "...", "labels": ["..."], "description": "...", "title": "...", "gitBranchName": "...",
    "rfc": {"title": "RFC: ...", "content": "<document markdown>", "url": "..."},
    "plan": {"title": "Plan: ...", "url": "..."},
    "children": [{"key": "ACT-301", "title": "...", "status": "...", "labels": ["RFC"], "blockedBy": ["ACT-300"]}] }
   ```

   Use `"rfc": null`, `"plan": null`, or `"children": []` when the issue has none. If Linear isn't connected, run the script without `--linear-json`; it then reports only the local draft.

6. Show the script's output as it is, in a code block. Below it, add at most two lines:
   - If it flags a status mismatch, say that act-sdlc doesn't change Linear, and the issue can be moved by hand.
   - If the next step is an act-sdlc command or `rfc.mjs export`, offer to run it.

## Without a key

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/phases.mjs" status`. It lists the drafts in `~/.act/openspec/changes/`. Mention that `/act-sdlc:status <KEY>` gives the phase, which needs Linear.

## Notes

- `[–]` is a gate that doesn't apply here, such as draft validation when there's no local draft. It never blocks.
- Testing passes when every repo with tasks has a passing line in the RFC's `5. Verification` section, which `/act-sdlc:verify` writes.
- `○` marks a phase that was passed without being tracked.
- Task progress comes from the checklist people tick in the Linear RFC, grouped by the `[repo]` tag at the start of each task.
