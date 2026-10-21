---
name: setup
description: Set up your translation API key in your act-sdlc profile (~/.config/act-sdlc/.env) and verify it works. Use for /act-sdlc:setup, "setup act-sdlc", "set my Gemini key", or when translate-issue fails because an API key is missing.
argument-hint: "[provider] [KEY=VALUE]"
allowed-tools: Bash(node:*)
---

# Set up the act-sdlc plugin

Arguments: `$ARGUMENTS`

API keys live in your developer profile at `~/.config/act-sdlc/.env` (under `$XDG_CONFIG_HOME` if set). It's never committed, and it survives plugin updates. Keys exported in the shell take precedence over that file.

## 1. Show current state

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" --status
```

The provider to set up is the one named in the arguments. Without one, use the configured provider, the one translate-issue uses:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" get translate.provider
```

## 2. If its key is already set

Verify it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" --check --provider <provider>
```

Report the result and stop.

## 3. If its key is missing

If the arguments contain `NAME=VALUE`, the user chose to give the key in chat. Save and verify it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" --set NAME=VALUE
```

Then tell them the key is now in this conversation's transcript, so they may want to rotate it later.

Otherwise, don't ask for the key in chat. Give the user these two options and wait:

1. **Recommended:** in a separate terminal, run the interactive setup. It hides the key as they paste it and verifies it:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs"
   ```
2. Or create `~/.config/act-sdlc/.env` (template: `${CLAUDE_PLUGIN_ROOT}/.env.example`) and fill in the key's line, e.g. `GEMINI_API_KEY=...`.

Tell them where to get a key: Gemini at https://aistudio.google.com/apikey, Claude at https://console.anthropic.com, OpenAI at https://platform.openai.com/api-keys, and OpenRouter at https://openrouter.ai/keys.

When they say they're done, run the step 2 check.

## 4. Finish

Once the check passes, tell the user:
- `/act-sdlc:translate-issue ACT-130` now works. No restart is needed, because the script reads `.env` on every run.
- To turn auto-translate on, run `/act-sdlc:config set translate.auto true`.
- To set up a project's `act/` folder, run `/act-sdlc:init` in that repo.
