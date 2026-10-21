---
name: config
description: Show or change act-sdlc settings (translation language, provider, model, auto-translate) for yourself, for this project's team, or for just you in this project. Use for /act-sdlc:config, "set my translation language to Hindi", "turn on auto-translate", "use Claude for translation in this repo", or "what act-sdlc settings am I using".
argument-hint: "[show | get <key> | set <key> <value> [--user|--project|--local] | unset <key> [--user|--project|--local]]"
allowed-tools: Bash(node:*)
---

# act-sdlc settings

Arguments: `$ARGUMENTS`

Settings come in layers. The first one that sets a key wins:

1. Env var, e.g. `SDLC_TRANSLATE_LANG`
2. `--local`: `act/config.local.json`. Just you, in this project. Gitignored.
3. `--project`: `act/config.json`. The whole team, in this project. Committed.
4. `--user`: `~/.config/act-sdlc/config.json`. Just you, in every project. This is the default scope.
5. Built-in default

Keys: `translate.language` (country code, default `id`), `translate.provider` (`gemini`, `claude`, `openai`, `openrouter`), `translate.model` (empty means the provider default), and `translate.auto` (`true`/`false`).

## What to run

Turn the request into one command and run it from the project directory:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" <show | get <key> | set <key> <value> [--scope] | unset <key> [--scope]>
```

- No arguments, or a question about current settings: run `show`. It lists every key with its value and the layer it came from.
- A plain-language request: map it to a key and scope.
  - "my language", "for me": `--user`.
  - "this repo for everyone", "the team": `--project`.
  - "just me in this repo": `--local`.
  - If the scope is unclear, use `--user`.
  - For example, "use Hindi in this repo" maps to `set translate.language in --local`.

After `set` or `unset`, run `show` and report the key's new value and source in one or two lines.

## Rules

- API keys are not settings. If the user tries to set one, send them to `/act-sdlc:setup`, which stores keys in their profile `.env`.
- After a `--project` change, remind the user to commit `act/config.json`. Personal preferences such as language belong in `--user` or `--local`, not `--project`.
- If a command fails, show its error. The error names the bad key, value, or file.
