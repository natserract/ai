---
name: review
description: Review a GitHub pull request, given a PR link or number, or the PRs linked to a Linear ticket. Checks correctness, conformance to the issue's RFC (scenarios, Call Graph, tasks), tests and quality, and security (the bundled OWASP-based method). Reports in chat, can post a comment-only review on the PR, and turns the findings you pick into new Linear issues. Never checks out or edits code. Use for /act-sdlc:review, "review this PR", "review ACT-95's PR", "security review PR #123", or reviewing a teammate's work.
argument-hint: <PR URL | PR number | ISSUE-KEY | linear issue URL> [--deep] [--no-comment]
allowed-tools: Bash Read Write Grep Glob Agent Skill mcp__claude_ai_Linear__get_issue mcp__claude_ai_Linear__get_document mcp__claude_ai_Linear__list_issues mcp__claude_ai_Linear__list_issue_labels mcp__claude_ai_Linear__save_issue mcp__linear__get_issue mcp__linear__get_document mcp__linear__list_issues mcp__linear__list_issue_labels mcp__linear__save_issue
---

# Review a pull request

Arguments: `$ARGUMENTS`

`/review` is the **reviewer's** view of a PR. It works from GitHub without checking anything out. The **author's** gate is `/act-sdlc:verify`, which runs on the local diff, proves findings with tests, and records results in the RFC. Both use the same security method.

Hard rules:
- **Code and git:** read only. Never check out, fetch, switch, edit, commit, or push.
- **GitHub:** write only a **comment** review and inline comments on the reviewed PR, and only when the user chooses to (step 5). Never approve or request changes; approving stays with people.
- **Linear:** only **create new issues**, for the findings the user picks. Never edit existing issues, RFC documents, statuses, or comments.

## 1. Resolve the targets

**A PR URL, `owner/repo#n`, or a bare number** (a bare number means the current directory's repo):

```bash
gh pr view <pr> --json number,title,body,url,state,author,headRefName,headRefOid,baseRefName,files,additions,deletions,headRepository
gh pr diff <pr>
```

Find Linear keys (`[A-Z]+-\d+`) in the PR's title, body, and branch name. Those are the linked issues.

Many PRs don't mention their ticket even when the ticket links the PR. ACT-164, for example, links `archix_cms_backend#1023`, but the PR names no key. If no key is found, ask the user once which Linear ticket the PR belongs to, or whether it has none. Without a ticket:
- RFC conformance is skipped, and the report says so;
- new issues need a team, which step 7 asks for.

**A Linear key or URL:** read the issue with `get_issue` (prefix `mcp__claude_ai_Linear__` or `mcp__linear__`), with `attachments`, `documents`, and `team`. Every attachment URL matching `github.com/<owner>/<repo>/pull/<n>` is a target. One ticket can have one PR per repo; review each.
- **No linked PR:** stop. Say that `/review` needs a pull request; local, unpushed work is `/act-sdlc:verify`'s job.

**For each linked issue,** read its `RFC:` document with `get_document`, if one exists. Save it to `/tmp/act-<KEY>-rfc.md` for `rfc.mjs`. If a PR is closed or merged, say so and still review it if the user asked.

## 2. Gather context without a checkout

- The diff from `gh pr diff` is the scope.
- Read the full changed files, their callers, and related tests at the PR's head commit:
  ```bash
  gh api "repos/<owner>/<repo>/contents/<path>?ref=<headRefOid>" --jq .content | base64 --decode
  ```
- Read the base version (`ref=<baseRefName>`) when you need to know what changed in behavior. Use `gh api "repos/<owner>/<repo>/git/trees/<headRefOid>?recursive=1"` to find related files.
- For large PRs, spread the reading across subagents (Agent tool), one per area, and merge their findings.

## 3. Review

Every finding gets:
- a **number**;
- a **severity**: critical, high, medium, or low;
- a **dimension**: correctness, RFC, tests/quality, or security;
- **`file:line`** at the PR head;
- **why** it matters;
- a **suggested fix**;
- **ask**: the people to involve. That's the PR author, plus the main authors of the affected file before this PR, from `gh api "repos/<owner>/<repo>/commits?path=<file>&sha=<baseRefName>&per_page=20"` (count the authors' `login`s and leave out bots). Use the RFC's **Ask** column instead when it covers the node. Use names and logins only, never emails.

Keep only real problems. Don't pad the list with style nits.

1. **Correctness.**
   - If the built-in `code-review` skill is available and the PR is in the current directory's repo, invoke it with the Skill tool on the PR number, **without** its option to post comments. This command does the posting in step 6.
   - Otherwise, review the diff yourself: logic errors, edge cases, error handling, and concurrency.
2. **RFC conformance**, only when a linked issue has an RFC:
   - **Scenarios:** each requirement scenario has a test in the PR or the repo. `skip_specs` RFCs skip this check.
   - **Call Graph:** the code matches it: names, failure handling per the node table, untrusted input parsed only at boundary nodes, and tests swapping dependencies as the **Tests:** line says.
   - **Tasks:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs" tasks /tmp/act-<KEY>-rfc.md --repo <repo>` shows whether this repo's tasks are ticked. Open tasks are a finding only if the PR claims to finish them.
   - **Scope:** behavior the RFC didn't plan is a finding.
3. **Tests and quality:**
   - missing or weak tests;
   - migrations without a rollback path, or with locking risk on large tables;
   - N+1 or unbounded queries;
   - breaking API changes;
   - new dependencies: are they needed and maintained?
   - committed secrets or config.
4. **Security.** Read `${CLAUDE_PLUGIN_ROOT}/docs/security-review.md` and follow it, including its section on reviewing without a checkout.
   - **Depth:** deep for the sensitive areas it lists, or when `--deep` is passed; standard otherwise. Say which and why.
   - **Proof:** there's no checkout, so there are no exploit tests here. A finding is **confirmed** only when the trace from attacker input to sink is unambiguous in the code you read. Otherwise mark it **unconfirmed**, and include the exploit test the author should write.
   - **Coverage:** list the OWASP areas checked, not applicable, or not assessable.
   - If the built-in `security-review` skill fits, meaning the PR is checked out in the current repo, you may use it as a second pass. Nothing requires it.

## 4. Report in chat

1. **Verdict** in one line: no blocking findings; findings to address; or blocking findings, meaning any critical or high.
2. **Findings**, in severity order, grouped by dimension. Each one: `#n [severity] title`, then `file:line` linked as `<pr url>/files`, why, the fix, and who to ask.
3. **Coverage:** which dimensions ran, the security depth, the OWASP areas, and anything not assessed. For example: "RFC conformance skipped: no RFC".

## 5. Ask once about outputs

Ask a single question covering both outputs, and wait for the answer:
- **PR comment:** post the review on the PR (the default), or skip. If `--no-comment` was passed, don't ask about this; it's skipped.
- **Linear issues:** which findings to turn into issues: numbers (e.g. `1,3`), `high+`, `all`, or `none`.

## 6. Post to the PR (if chosen)

1. **Don't double-post.** List existing reviews with `gh api repos/<owner>/<repo>/pulls/<n>/reviews`. If one already contains `Review by act-sdlc` and the same head commit `<headRefOid>`, skip posting and say so.
2. **Post one review** with the summary as its body, and inline comments for findings that have a line:
   ```bash
   gh api repos/<owner>/<repo>/pulls/<n>/reviews --method POST --input /tmp/act-review-<n>.json
   ```
   The JSON contains:
   - `commit_id`: `<headRefOid>`;
   - `event`: `COMMENT`;
   - `body`: the verdict and the findings list, ending with `Review by act-sdlc · <headRefOid short>`;
   - `comments`: `[{ "path", "line", "side": "RIGHT", "body" }]`, one per finding whose line is in the diff.

   Findings outside the diff appear only in the body.
3. If GitHub rejects an inline comment because the line isn't in the diff, move that finding into the body and post again once.

## 7. Create the chosen Linear issues

For each chosen finding:

1. **Team:** the linked ticket's team. If there's no ticket, ask which team, once for all findings.
2. **Duplicate check:** search with `list_issues` for open issues in that team with a near-identical title. If one exists, don't create another; list it in the report as already tracked.
3. **Labels:** get the team's labels with `list_issue_labels` and use only ones that exist:
   - `Bug` for defects, including security findings;
   - `Improvement` for quality findings.
4. **Create** with `save_issue`:
   - `team`;
   - `title`: the finding's short title, for example "IDOR on GET /grants/:id";
   - `priority`: critical → 1 (Urgent), high → 2, medium → 3, low → 4;
   - `labels`;
   - `relatedTo`: the source ticket key, if there is one. Never `parentId`: a child would make the source ticket an umbrella;
   - `description`, as Markdown:
     ```markdown
     Found by act-sdlc review of <PR url> (<file:line>) at <headRefOid short>.

     **Severity:** <severity> · **Category:** <dimension>, <OWASP id if security> · <confirmed | unconfirmed>

     ## Problem
     <why it matters, with the code path>

     ## Suggested fix
     <fix at the root cause>

     ## Acceptance criteria
     - <testable outcome, e.g. "a request for another user's grant returns 404, covered by a test">
     ```
   - Don't set an assignee, status, cycle, or estimate.
5. If a create fails, stop. Report what was created; don't retry blindly.

## 8. Final report

- The PR review link, or "not posted" and why.
- The issues created, with keys and links, and any that were already tracked.
- **Next:**
  - `/act-sdlc:plan <new key>` to triage the new issues;
  - the PR author fixes the findings and runs `/act-sdlc:verify <KEY>` in the repo.
