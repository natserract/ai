---
name: setup
description: Set up the sdlc plugin's translation API key in its .env file and verify it works. Use for /sdlc:setup, "setup sdlc", "set my Gemini key", or when translate-issue fails because an API key is missing.
argument-hint: "[provider] [KEY=VALUE]"
allowed-tools: Bash(node:*)
---

# Set up the sdlc plugin

Arguments: `$ARGUMENTS`

The plugin reads API keys from `${CLAUDE_PLUGIN_ROOT}/.env`. Keys exported in the shell take precedence over that file.

## 1. Show current state

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" --status
```

The provider to set up is the one named in the arguments. Without one, use `${user_config.translate_provider}`, which is the provider translate-issue uses.

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
2. Or open `${CLAUDE_PLUGIN_ROOT}/.env`, which you can create from `.env.example` in the same directory, and fill in the key's line.

Tell them where to get a key: Gemini at https://aistudio.google.com/apikey, Claude at https://console.anthropic.com, OpenAI at https://platform.openai.com/api-keys, and OpenRouter at https://openrouter.ai/keys.

When they say they're done, run the step 2 check.

## 4. Finish

Once the check passes, tell the user:
- `/sdlc:translate-issue ACT-130` now works. No restart is needed, because the script reads `.env` on every run.
- To turn auto-translate on, set `auto_translate` for the sdlc plugin in `/config`.
