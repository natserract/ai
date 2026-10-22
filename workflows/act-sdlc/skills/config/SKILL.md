---
name: config
description: Show or change your act-sdlc settings (translation language, provider, model, auto-translate, light-path labels, Call Graph requirement). Use for /act-sdlc:config, "set my translation language to Hindi", "turn on auto-translate", "treat Bug issues as light path", or "what act-sdlc settings am I using".
argument-hint: "[show | get <key> | set <key> <value> | unset <key>]"
allowed-tools: Bash(node:*)
---

# act-sdlc settings

Arguments: `$ARGUMENTS`

Settings are personal and live in your profile, `~/.config/act-sdlc/config.json`. App repositories are never touched. The first match wins:

1. Env var, e.g. `SDLC_TRANSLATE_LANG`
2. Your profile
3. Built-in default

| Key | Default | Meaning |
| :- | :- | :- |
| `translate.language` | `id` | Target language as a country code |
| `translate.provider` | `gemini` | `gemini`, `claude`, `openai`, or `openrouter` |
| `translate.model` | empty | Model ID override; empty means the provider default |
| `translate.auto` | `false` | Translate when a prompt contains a Linear issue URL |
| `phases.lightLabels` | `Small Size` | Comma-separated Linear labels that take the light path |
| `phases.callGraph` | `true` | Full-path RFCs must have a Call Graph |
| `start.skills` | empty | Skills `/start` runs for every code task, e.g. `pstack:tdd,code-review` |
| `plan.autoSplit` | `true` | `/plan` splits too-large issues into sub-issues |
| `rfc.publish` | `true` | `/to-spec` publishes the RFC document and a comment to Linear |

## What to run

Turn the request into one command:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" <show | get <key> | set <key> <value> | unset <key>>
```

- **No arguments, or a question about current settings:** run `show`. It lists every key with its value and where it came from, plus the workspace path.
- **A plain-language request:** map it to a key. For example, "treat Bugs as light path too" becomes `set phases.lightLabels "Small Size,Bug"`.
- After `set` or `unset`, report the key's new value in one line.

## Rules

- API keys are not settings. Send the user to `/act-sdlc:setup`, which stores keys in the profile `.env`.
- There are no team or per-repo settings, so app repos stay untouched. If the team wants shared conventions, write them in the `rules:`/`context:` of `~/.act/openspec/config.yaml` and share that snippet; each developer pastes it into their own workspace.
- If a command fails, show its error. The error names the bad key, value, or file.
