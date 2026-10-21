# ACT SDLC Workflows

A Claude Code plugin that encodes natserract development workflow: work arrives as a Linear issue, then we build it.

## Install

Source: [github.com/natserract/ai](https://github.com/natserract/ai/tree/main/workflows/act-sdlc), in `workflows/act-sdlc`. The marketplace (`actual`) is defined at the repository root in `.claude-plugin/marketplace.json`.

### From GitHub

```bash
claude plugin marketplace add natserract/ai
claude plugin install act-sdlc@actual
```

To offer the plugin to everyone who opens a project, commit this to that project's `.claude/settings.json`:

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

### From a clone

```bash
git clone https://github.com/natserract/ai.git
cd ai
claude plugin marketplace add ./
claude plugin install act-sdlc@actual
```

The plugin runs from your clone, so `git pull` brings updates.

To work on the plugin itself, load it without installing:

```bash
claude --plugin-dir ./workflows/act-sdlc
```

Requirements: Node 20.12 or later, and the Linear MCP connected (claude.ai connector settings, or `/mcp`).

## Get started

1. **Add your API key, once per machine:** run `/act-sdlc:setup`. The key goes to your profile at `~/.config/act-sdlc/.env`, which survives plugin updates.
2. **Set up each project, once per repo:** run `/act-sdlc:init` in the repo, then commit `act/config.json` and `act/.gitignore`.
3. **Translate an issue:** run `/act-sdlc:translate-issue ACT-130`. The result goes to `act/issues/ACT-130.id.md`.

## Commands

| Command | What it does |
| :- | :- |
| `/act-sdlc:setup [provider]` | Checks your translation API key, explains how to add a missing one to your profile `.env`, and verifies it. |
| `/act-sdlc:init` | Creates the project's `act/` folder: team `config.json` and a `.gitignore` for personal files. |
| `/act-sdlc:config [show \| set \| unset …]` | Shows or changes settings for you (`--user`), the team (`--project`), or just you in this repo (`--local`). See [docs/configuration.md](docs/configuration.md). |
| `/act-sdlc:translate-issue <ACT-130 \| URL> [--lang <code>] [--force]` | Translates a Linear issue into another language, chosen by country code (`id` Indonesian by default, `in` Hindi, `jp` Japanese, and more), and saves it to `act/issues/<KEY>.<code>.md`. See [docs/translation.md](docs/translation.md). |

## Configuration

Every developer has a profile at `~/.config/act-sdlc/`, holding personal settings and API keys. Every project has an `act/` folder, holding team settings and personal overrides. For a project's own settings, the first layer that sets a key wins: `act/config.local.json` (you), then `act/config.json` (team), then your profile.

```
/act-sdlc:config show                                   # every setting and where it comes from
/act-sdlc:config set translate.language in              # you, every project
/act-sdlc:config set translate.language jp --project    # the team, this project
/act-sdlc:config set translate.auto true --local        # you, this project
```

| Key | Default | Meaning |
| :- | :- | :- |
| `translate.language` | `id` | Target language as a country code. See [the language list](docs/translation.md#choose-a-language). |
| `translate.provider` | `gemini` | `gemini`, `claude`, `openai`, or `openrouter`. |
| `translate.model` | empty | Model ID override. Required for `openai` and `openrouter`. |
| `translate.auto` | `false` | Translate automatically when a prompt contains a Linear issue URL. |

Full details: [docs/configuration.md](docs/configuration.md).

## Roadmap

- `/to-spec`: turn a Linear issue into a spec change owned by the project, using [OpenSpec](https://github.com/Fission-AI/openspec) inside `act/openspec/`.
- `/to-tickets`: split a spec into tracer-bullet tickets with blocking edges.
- `/wayfinder`: plan large work as a map of decision tickets, resolved one at a time.
- `/prototype`: answer one unclear logic or UI question with throwaway code.
- `/handoff`: carry context to another harness, directory, colleague, or side task.
- `/triage`: check readiness and apply triage labels.
- Proposed: `/start-task` (issue → branch, context file, In Progress), `/ship` (PR linked to the issue, In Review), `/standup`.
