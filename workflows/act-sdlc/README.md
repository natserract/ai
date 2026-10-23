# ACT SDLC Workflows

A Claude Code plugin for natserract's development workflow. Work starts as a Linear issue, and act-sdlc helps you take it from idea to release:

```
 Linear issue ──► /plan ──► /to-spec ──► review in Linear ──► /start ──► /verify ──► release
                 triage     write the      (people approve)    build one   check tests,
                 & split    RFC                                task at a   design &
                                                               time        security
```

Each issue gets one **RFC** (a plan document) in Linear. People review and approve it there, and Claude follows it to build and check the work.

## Quick start

**1. Install** (once):

```bash
claude plugin marketplace add natserract/ai
claude plugin install act-sdlc@actual
```

**2. Set up your machine** (once), inside Claude Code:

```
/act-sdlc:init      # creates your workspace ~/.act/
/act-sdlc:setup     # adds your translation API key (optional)
```

**3. Work on an issue,** for example ACT-95:

| Step | Run | What happens |
| :- | :- | :- |
| 1. Plan | `/act-sdlc:plan ACT-95` | Checks whether the issue is ready, adds labels, and splits it into sub-issues if it's too big |
| 2. Write the plan | `/act-sdlc:to-spec ACT-95` | Writes the RFC and posts it to the issue in Linear |
| 3. Approve | *(in Linear)* | The team reviews the RFC, then moves the issue to **In Progress** |
| 4. Build | `/act-sdlc:start ACT-95` | Does the next task for the current repo, checks it, and ticks it in the RFC. Run it again for the next task |
| 5. Check | `/act-sdlc:verify ACT-95` | Checks tests, design, and security, and records pass or fail in the RFC |
| 6. Release | *(in Linear)* | Ship it, then move the issue to **Done/Released** |

Lost? Run `/act-sdlc:help` for every command and a check of your setup, or `/act-sdlc:status ACT-95` to see where an issue is and what to do next.

## Commands

### Day to day

| Command | Use it to |
| :- | :- |
| `/act-sdlc:plan <issue>` | Triage an issue, and split big ones into smaller sub-issues |
| `/act-sdlc:to-spec <issue>` | Write the issue's RFC and post it to Linear |
| `/act-sdlc:start <issue>` | Build the next RFC task in the current repo |
| `/act-sdlc:verify <issue>` | Check the finished work in the current repo before release |
| `/act-sdlc:status <issue>` | See where an issue stands and what's next |
| `/act-sdlc:review <PR link or issue>` | Review a teammate's pull request |

### Reading

| Command | Use it to |
| :- | :- |
| `/act-sdlc:open <issue>` | Open the RFC in your language (`--en` for English, `--linear` to open it in Linear) |
| `/act-sdlc:translate-issue <issue>` | Translate a Linear issue into your language |

### Setup

| Command | Use it to |
| :- | :- |
| `/act-sdlc:init` | Create your workspace `~/.act/` (once per machine) |
| `/act-sdlc:setup` | Add or check your translation API key |
| `/act-sdlc:config` | Show or change your settings |
| `/act-sdlc:help` | List every command, check your setup, and get a suggestion for the repo you're in. `/act-sdlc:help start` explains one command |

`<issue>` is an issue key such as `ACT-95`, or a Linear issue URL.

<details>
<summary><b>Options for each command</b></summary>

| Command | Options |
| :- | :- |
| `plan` | `--no-split`: show the proposed split without creating sub-issues |
| `to-spec` | `--no-publish`: keep the RFC on your machine instead of posting it |
| `start` | `--task 2.2`: a specific task. `--group 3`: a whole task group. `--all`: every open task. `--force`: start before the RFC is approved |
| `verify` | `--deep`: a deeper security review. `--base <branch>`: compare against another branch |
| `review` | `--deep`: a deeper security review. `--no-comment`: don't post on the PR |
| `open` | `--en`: the English RFC. `--linear`: open it in Linear. `--print`: show it in chat |
| `translate-issue` | `--lang in`: another language. `--force`: translate again. `--summary`: show only a summary |

</details>

## What each step checks

- **`/plan`:** is the issue clear, and does it have acceptance criteria? Is it small enough for one RFC? If it's too big, it's split into **decision** tickets (questions to answer first) and **work** tickets, with an order between them.
- **`/to-spec`:** the RFC has four parts:
  1. **Proposal:** why the work is needed.
  2. **Requirements:** what must be true, as testable scenarios.
  3. **Design:** how it works, including a [Call Graph](docs/call-graph.md) diagram and **who to ask** about each part of the code.
  4. **Tasks:** a checklist, each task tagged with its repo.
- **`/start`:** follows the RFC's design, runs each task's own check, and only then ticks the task.
- **`/verify`:** every scenario has a passing test, the code matches the design, a code review, and a [security review](docs/security-review.md) based on the OWASP Top 10, which goes deeper for sensitive areas such as auth, payments, and personal data.
- **`/review`:** the same checks on a pull request, without checking it out. It can post the review on the PR, and turn the findings you pick into new Linear issues.

## What act-sdlc changes, and what it doesn't

| Where | act-sdlc may | It never |
| :- | :- | :- |
| **Linear** | Post the RFC and one comment (`/to-spec`); add labels and create sub-issues (`/plan`); tick tasks (`/start`); record verify results in the RFC (`/verify`); create issues you pick (`/review`) | Change an issue's status, assignee, title, or description, or remove labels |
| **GitHub** | Post a comment review on a PR, when you choose to (`/review`) | Approve or request changes |
| **Your code** | Edit files while building (`/start`) and add tests (`/verify`) | Create or switch branches, commit, or push. Git is yours |
| **Your machine** | Keep drafts and translations in `~/.act/`, and settings in `~/.config/act-sdlc/` | Add files to your app repositories |

People move issue statuses, assign work, and approve PRs.

## Settings

Settings are personal. Change them with `/act-sdlc:config`:

```
/act-sdlc:config show                          # see every setting
/act-sdlc:config set translate.language jp     # translate into Japanese
/act-sdlc:config set rfc.publish false         # keep RFCs on your machine
```

| Setting | Default | What it does |
| :- | :- | :- |
| `translate.language` | `id` | Your language, as a country code: `id` Indonesian, `in` Hindi, `jp` Japanese, and [more](docs/translation.md#choose-a-language) |
| `translate.provider` | `gemini` | Which AI translates: `gemini`, `claude`, `openai`, or `openrouter` |
| `translate.model` | empty | A specific model. Required for `openai` and `openrouter` |
| `translate.auto` | `false` | Translate automatically when you paste a Linear issue link |
| `rfc.publish` | `true` | Post RFCs to Linear |
| `plan.autoSplit` | `true` | Split big issues into sub-issues automatically |
| `phases.lightLabels` | `Small Size` | Labels for small issues that get a short RFC |
| `phases.callGraph` | `true` | Require a Call Graph in every full RFC |
| `start.skills` | empty | Extra skills to run for every task, e.g. `code-review` |

More detail: [docs/configuration.md](docs/configuration.md).

## Install options

**Requirements:**
- Claude Code;
- Node.js 20.19 or later;
- Linear connected to Claude, through your claude.ai connector settings or `/mcp`;
- the GitHub CLI (`gh`) logged in, for `/review` only.

**For a whole team:** commit this to a project's `.claude/settings.json`, so everyone who opens the project is offered the plugin:

```json
{
  "extraKnownMarketplaces": {
    "actual": { "source": { "source": "github", "repo": "natserract/ai" } }
  },
  "enabledPlugins": {
    "act-sdlc@actual": true
  }
}
```

**From a local clone** (updates come with `git pull`):

```bash
git clone https://github.com/natserract/ai.git
cd ai
claude plugin marketplace add ./
claude plugin install act-sdlc@actual
```

**To work on the plugin itself:**

```bash
claude --plugin-dir ./workflows/act-sdlc
```

The plugin's source is in [`workflows/act-sdlc`](https://github.com/natserract/ai/tree/main/workflows/act-sdlc). The `actual` marketplace is defined in `.claude-plugin/marketplace.json` at the repository root.

## Learn more

| Doc | Read it for |
| :- | :- |
| [docs/lifecycle.md](docs/lifecycle.md) | The full workflow: the 7 phases, who does what, and how issues move |
| [docs/call-graph.md](docs/call-graph.md) | How to draw and review a Call Graph |
| [docs/security-review.md](docs/security-review.md) | The security review method |
| [docs/configuration.md](docs/configuration.md) | Every setting, and where files live |
| [docs/translation.md](docs/translation.md) | Translation setup, languages, and providers |

## Coming next

- **`/prototype`:** answer one unclear design question with a quick throwaway experiment.
- **`/handoff`:** hand unfinished work to a teammate or a new session.
- **`/report-bug`:** turn a production bug into an issue linked to the RFC it breaks.
