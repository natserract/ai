# How we work: the 7 SDLC phases

act-sdlc follows the seven phases of the software development life cycle: Planning, Analysis, Design, Development, Testing, Deployment, and Maintenance. Every issue gets **one RFC document in Linear**. People and agents both read the plan from there.

To see where any issue stands, run:

```
/act-sdlc:status ACT-95
```

## Who writes what, and where

| | Writes | Where |
| :- | :- | :- |
| **Claude** (`/act-sdlc:to-spec`) | The RFC draft: proposal, requirements with scenarios, design with a Call Graph, tasks | Your local workspace `~/.act/`, outside every repo |
| **Claude** (`/act-sdlc:to-spec`, publish step) | The issue's `RFC:` document (created, or updated on revision) and one notification comment | Linear |
| **People** | Review the RFC, tick its tasks, move the status | Linear |
| **Claude** (`/act-sdlc:status`, later `/start` and `/verify`) | Nothing in Linear. Reads the issue and its RFC | Reads Linear |

**What act-sdlc writes to Linear:** `/act-sdlc:to-spec` writes the RFC document and a notification comment. `/act-sdlc:plan` adds labels (it never removes any) and, when it splits an issue, creates sub-issues with blocking relations and a `Plan:` document. `/act-sdlc:start` ticks finished tasks in the RFC's checklist, and `/act-sdlc:verify` records each repo's result in the RFC's Verification section. Neither changes anything else. `/act-sdlc:review` creates new issues, but only for the findings you pick, and, outside Linear, posts a comment-only review on the GitHub PR when you choose to. Nothing ever changes an issue's status, assignee, title, or description, or edits other people's comments. `rfc.publish` and `plan.autoSplit` turn the writes off. App repositories stay untouched, because the drafts live in `~/.act/`.

## The phases

| Phase | Roles | Linear status | Command | What exists afterwards | Exit gate |
| :- | :- | :- | :- | :- | :- |
| 1 Planning | Everyone | Backlog, Todo | `/act-sdlc:plan` | Triage labels; for large work, decision and work sub-issues and a `Plan:` document | Description with an "Acceptance criteria" section (a split issue is tracked through its sub-issues) |
| 2 Analysis | PO, PM, BA, CTO | Todo, RFC | `/act-sdlc:to-spec` | Local draft: proposal and requirements with scenarios | Requirements with scenarios written; the draft passes `openspec validate --strict` |
| 3 Design | System Architect, UX/UI Designer | RFC | `/act-sdlc:to-spec` (publishes the RFC) | `RFC: <title>` document on the issue, with design, [Call Graph](call-graph.md), and task checklist | RFC on the issue, with a Call Graph and a checklist, and **approved**: the issue is moved to In Progress |
| 4 Development | Front-end and Back-end Developers | In Progress | `/act-sdlc:start` | Code in each repo; ticked checklist in the RFC | Every RFC task ticked in Linear |
| 5 Testing | Solutions Architect, QA Engineer, Tester, DevOps | In Progress | `/act-sdlc:verify` | Scenario tests, exploit tests, and a pass or fail line per repo in the RFC's Verification section | Every repo with tasks has a passing Verification line |
| 6 Deployment | Data Administrator, DevOps | Ready to be Released | Linear | Release | Linear says Done/Released |
| 7 Maintenance | Users, Testers, Support Managers | Done/Released | `/act-sdlc:review` | Production | Bugs and review findings become new issues that link the source ticket, and start again at Planning |

`scripts/phases.mjs` holds these rules as data. An issue is in the first phase whose exit gate isn't met. A gate marked `[–]` doesn't apply or isn't tracked yet, and never blocks.

## End to end

```
 PEOPLE (Linear)                         CLAUDE                                WHERE IT'S WRITTEN
 1. Write the issue + acceptance
    criteria
 2.                                      /act-sdlc:to-spec ACT-95
                                         read issue, comments, code (all repos)
                                         write + validate the draft           ~/.act/openspec/changes/act-95-…/
                                         export one RFC                       ~/.act/rfc/ACT-95.md
                                         publish: RFC document + comment      Linear issue ACT-95
 3. Move to RFC; review and comment
    inline in the RFC document
 4. Approve: move to In Progress
                                         ── a new session, any developer ──
 5.                                      read the RFC from Linear             (Linear)
                                         implement task by task, per repo
 6. Tick each task in the RFC as it's
    done
 7. Release; move to Done/Released
    any time: /act-sdlc:status ACT-95 → phase, gates, tasks per repo, next step
```

The RFC in Linear is the shared memory. Any developer's Claude, in any session or repository, reads the same approved plan instead of starting from scratch.

## Who to ask

Every RFC says who to ask. The Call Graph's node table has an **Ask** column, and a **Context & people** section follows the Call Graph. `/act-sdlc:to-spec` fills them in from real sources:
- CODEOWNERS and git history for each function, through `scripts/who.mjs`, which narrows blame and log to the function itself;
- the PRs that last changed the code;
- related Linear issues and their RFCs;
- the people who made decisions in the comments.

People appear as Linear @mentions or GitHub logins, with the date of their last change. Emails never appear.

When `/act-sdlc:start` stops on a question, it names who to ask, and every `/act-sdlc:review` finding says who to involve. See [call-graph.md](call-graph.md#context--people).

## Planning: triage, then split

`/act-sdlc:plan ACT-95` is the first step for any issue. It reads the issue, its comments, and existing sub-issues, then gives one verdict:

| Verdict | Means | What happens |
| :- | :- | :- |
| **Ready** | Clear problem and outcome, fits one RFC | Labels added; next: `/act-sdlc:to-spec` |
| **Needs info** | The problem or outcome isn't clear yet | Labels added; the questions to ask are listed in chat (nothing is posted) |
| **Too large** | Several shippable stages, or decisions that must come first | Split by default into sub-issues, plus a `Plan:` document on the parent |

When it splits, it creates two kinds of sub-issues, linked by blocking relations:
- **Decision tickets** (`Decide: …`, label `RFC`): a question whose answer changes the design, such as a vendor choice or a threshold. Their RFC records the decision.
- **Work tickets:** vertical slices that each ship alone, each with its own acceptance criteria.

The parent then becomes an **umbrella**: `/act-sdlc:status ACT-95` shows progress across its sub-issues and names the next one with no open blockers. Each sub-issue goes through Analysis → Design → … on its own, starting with `/act-sdlc:to-spec`.

Pass `--no-split`, or set `plan.autoSplit` to `false`, to get the proposed map in chat without creating anything. Running `/act-sdlc:plan` again on an already split issue never creates duplicate tickets.

## Development: /start

`/act-sdlc:start ACT-184`, run inside a repository, takes the next open task tagged with that repository from the approved RFC. Approved means the issue is In Progress or later. It then:

1. loads only the context that task needs: the Why, the relevant scenarios, the decisions, and the Call Graph nodes it names;
2. implements it, following the Call Graph;
3. runs the task's `Verify:`, then ticks the task in the RFC in Linear. If the verify fails, nothing is ticked.

**One task per run** by default, so each step can be reviewed and context stays small. `--task 2.2`, `--group 3`, or `--all` do more; `--all` gives each task a fresh subagent and stops at the first failure. Because progress lives in the Linear checklist, anyone can continue in a new session with `/act-sdlc:start` again.

**Human tasks**, such as an interview, a review with people, or getting access, aren't coded. `/start` asks whether the task is done and ticks it if so.

**Skills stay yours.** `/start` doesn't replace them:
- skills that match the work still trigger on their own;
- you can call any skill at any time;
- `start.skills` lists skills that run for every code task, for example `pstack:tdd,code-review`.

**Git stays yours.** `/start` never creates or switches branches, and never commits or pushes. Changes are left in your working tree.

## Testing: /verify

`/act-sdlc:verify ACT-95`, run in each repository once its tasks are ticked, checks that repository's part of the change against the RFC:

1. **Requirements:** every scenario has a test, and it passes. Missing tests are written. For `skip_specs` RFCs, every task's `Verify:` is re-run instead.
2. **Design:** the code matches the Call Graph: the names, the failure handling, input parsed only at boundary nodes, and tests that swap dependencies.
3. **Code review:** the built-in `code-review` skill when available.
4. **Security review:** act-sdlc's own [security review method](security-review.md), OWASP Top 10:2025 plus the API Top 10. It goes **deep** automatically for sensitive areas such as auth, credits or trials, personal data, public endpoints, vendors, and LLM input. Findings are proven with local exploit tests. Built-in `security-review` and any scanner a developer has installed add evidence, but nothing requires them.

The result is one line per repository in the RFC's **5. Verification** section:

```
- [x] archix_cms_backend · passed · 2026-10-22 · scenarios 3/3 · security (deep): no high or critical
- [ ] archix_frontend · failed · 2026-10-22 · XSS in pending-review banner (high)
```

A failing scenario, a behavior-breaking mismatch with the Call Graph, or a critical or high security finding fails the repository. The issue leaves Testing once every repository with tasks has passed. Like `/start`, `/verify` never touches git. The tests it adds are left uncommitted.

## Reviewing a PR: /review

`/act-sdlc:review` reviews someone's pull request. Give it a PR link, `owner/repo#123`, a number, or a Linear ticket, in which case it reviews the PRs linked to that ticket. It reads everything from GitHub and never checks out or edits code.

It checks four things:
- **correctness**, using the built-in `code-review` skill when it fits;
- **RFC conformance**, when the PR links an issue with an RFC: scenarios have tests, the code matches the Call Graph, tasks are ticked, and nothing was built that the RFC didn't plan;
- **tests and quality**: migrations, query performance, breaking changes, dependencies;
- **security**, with the [security review method](security-review.md). Without a checkout, findings are marked confirmed or unconfirmed rather than proven with tests.

The report comes to chat first. Then it asks one question:
- **Post the review on the PR?** It's always a comment review, never approve or request changes, and it's posted once per head commit.
- **Which findings should become Linear issues?** Answer with numbers, `high+`, `all`, or `none`. New issues get labels from the team, a priority from the severity, a link to the PR line, acceptance criteria, and a "related to" link to the source ticket. An open issue with the same title is reused instead of duplicated.

`/review` is the reviewer's tool. `/verify` is the author's gate before Deployment.

## The RFC in your language

The RFC in Linear is always in English. `/act-sdlc:to-spec` also translates it into your default language (`translate.language`) and keeps the translation **only on your machine**, in `~/.act/rfc/<KEY>.<lang>.md`. It's never posted to Linear.

```
/act-sdlc:open ACT-95            # your translation, in your Markdown app (synced from Linear first)
/act-sdlc:open ACT-95 --print    # the same, shown in chat
/act-sdlc:open ACT-95 --en       # the English copy
/act-sdlc:open ACT-95 --linear   # the RFC document in Linear, in the browser
```

`/act-sdlc:open` always pulls the latest English RFC from Linear first, so edits people made there show up in your translation. It only calls the translation API again when the English text changed.

## One RFC, several repositories

An issue such as ACT-95 touches several repositories, for example backend, frontend, and AI Service. One RFC covers all of them:

- The **Call Graph** uses a sequence diagram when the flow crosses services or repos.
- Each **task** starts with its repository: `- [ ] [archix_cms_backend] 1.1 …`.
- `/act-sdlc:status` shows progress per repository:

```
Tasks: 1/3
  archix_cms_backend           1/2
  archix_frontend              0/1
```

## The light path

Not every issue needs a full RFC. Issues with a light-path label (`Small Size` by default; set `phases.lightLabels` to change it) get a short proposal, a one-line design, and a Call Graph as numbered steps. Issues that change no observable behavior, such as refactors, tooling, or pure audits, set `skip_specs` instead of inventing requirements.

## Revising an RFC

People may edit the RFC directly in Linear, which is fine. Linear keeps version history. To have Claude revise it, run `/act-sdlc:to-spec ACT-95` again. It reads the current RFC from Linear first, drafts the revision from it, updates the same document (keeping ticked tasks), and comments with a summary of what changed. Linear's version history keeps every earlier version.

## What exists today and what comes next

| Phase | Today | Next |
| :- | :- | :- |
| Planning | `/act-sdlc:plan` (triage + split) | – |
| Analysis, Design | `/act-sdlc:to-spec`, `/act-sdlc:translate-issue` | `/prototype` for one unclear logic or UI question |
| Development | `/act-sdlc:start` (one task at a time, ticked in Linear) | `/handoff` |
| Testing | `/act-sdlc:verify` (scenarios, Call Graph, code review, security review) | – |
| Deployment | Gate read from Linear | – |
| Maintenance | `/act-sdlc:review` (findings → new issues) | `/report-bug`: an issue from a production bug that links the RFC and the requirement it breaks |
