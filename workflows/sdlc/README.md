# SDLC Workflows

A Claude Code plugin that encodes natserract development workflow: work arrives as a Linear issue, then we build it.

## Install

Source: [github.com/natserract/ai](https://github.com/natserract/ai/tree/main/workflows/sdlc), in `workflows/sdlc`. The marketplace (`actual`) is defined at the repository root in `.claude-plugin/marketplace.json`.

### From GitHub

```bash
claude plugin marketplace add natserract/ai
claude plugin install sdlc@actual
```

Claude Code keeps a GitHub install in a versioned cache. Each plugin update creates a fresh copy without your `.env`, so run `/sdlc:setup` again after updating. See [docs/translation.md](docs/translation.md#where-env-lives-after-installing).

To offer the plugin to everyone who opens a project, commit this to that project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "actual": { "source": { "source": "github", "repo": "natserract/ai" } }
  },
  "enabledPlugins": {
    "sdlc@actual": true
  }
}
```

### From a clone

```bash
git clone https://github.com/natserract/ai.git
cd ai
claude plugin marketplace add ./
claude plugin install sdlc@actual
```

The plugin runs from your clone, so `git pull` brings updates, and your `.env` stays where it is.

To work on the plugin itself, load it without installing:

```bash
claude --plugin-dir ./workflows/sdlc
```

Requirements: Node 20.12 or later, and the Linear MCP connected (claude.ai connector settings, or `/mcp`).

Then run `/sdlc:setup` to add your translation API key to `workflows/sdlc/.env`. See [docs/translation.md](docs/translation.md#set-up-an-api-key).

## Commands

| Command | What it does |
| :- | :- |
| `/sdlc:setup [provider]` | Checks your translation API key, explains how to add a missing one to `.env`, and verifies it. |
| `/sdlc:translate-issue <ACT-130 \| URL> [--force]` | Translates a Linear issue into Bahasa Indonesia and saves it to `.sdlc/issues/<KEY>.id.md`. See [docs/translation.md](docs/translation.md). |

## Settings

Change these in `/config` (look under the sdlc plugin) or with `claude plugin configure sdlc`.

| Option | Default | Meaning |
| :- | :- | :- |
| `auto_translate` | `false` | Translate automatically when a prompt contains a Linear issue URL. |
| `translate_provider` | `gemini` | `gemini`, `claude`, `openai`, or `openrouter`. |
| `translate_model` | empty | Model ID override. Required for `openai` and `openrouter`. |

## Roadmap

- `/to-spec`: turn a discussion into a spec issue.
- `/to-tickets`: split a spec into tracer-bullet tickets with blocking edges.
- `/wayfinder`: plan large work as a map of decision tickets, resolved one at a time.
- `/prototype`: answer one unclear logic or UI question with throwaway code.
- `/handoff`: carry context to another harness, directory, colleague, or side task.
- `/triage`: check readiness and apply triage labels.
- Proposed: `/start-task` (issue → branch, context file, In Progress), `/ship` (PR linked to the issue, In Review), `/standup`.
