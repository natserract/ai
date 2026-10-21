# Linear issue translation

`/sdlc:translate-issue` reads a Linear issue through the Linear MCP and writes two files to the project:

- `.sdlc/issues/<KEY>.en.md`: the issue as fetched (title, metadata, description, comments).
- `.sdlc/issues/<KEY>.id.md`: the Bahasa Indonesia translation.

Claude fetches the issue. A separate model does the translation through `scripts/translate.mjs`. Code, URLs, identifiers, and common technical terms are left in English.

Add `.sdlc/` to your project's `.gitignore`.

## Set up an API key

The translator reads API keys from `.env` at the plugin root (`workflows/sdlc/.env`). This file is gitignored. If a key is also exported in your shell, the shell value is used.

| Provider | Env var | Default model | Get a key |
| :- | :- | :- | :- |
| `gemini` (default) | `GEMINI_API_KEY` | `gemini-3.8-flash` | https://aistudio.google.com/apikey |
| `claude` | `ANTHROPIC_API_KEY` | `claude-sonnet-5-5` | https://console.anthropic.com |
| `openai` | `OPENAI_API_KEY` | none: set `translate_model` | https://platform.openai.com/api-keys |
| `openrouter` | `OPENROUTER_API_KEY` | none: set `translate_model`, e.g. `google/gemini-3.8-flash` | https://openrouter.ai/keys |

### Option 1: guided setup (recommended)

In Claude Code, run:

```
/sdlc:setup
```

It shows which keys are set, explains how to add the missing one, and verifies the key with a free API call. `/sdlc:setup claude` sets up a provider other than the one in your config.

You can also run the setup script yourself in a terminal. It hides the key while you paste it:

```bash
node workflows/sdlc/scripts/setup.mjs
```

### Option 2: edit `.env` by hand

```bash
cp workflows/sdlc/.env.example workflows/sdlc/.env
# then fill in the line for your provider, e.g. GEMINI_API_KEY=AIza...
node workflows/sdlc/scripts/setup.mjs --check
```

### Setup script reference

| Command | What it does |
| :- | :- |
| `node scripts/setup.mjs` | Asks for a provider and key (hidden input), saves it to `.env`, and verifies it |
| `node scripts/setup.mjs --status` | Lists each provider's key: not set, or set from the shell or `.env` (last 4 characters only) |
| `node scripts/setup.mjs --check [--provider gemini]` | Calls each configured provider's model list endpoint to confirm its key works. No tokens are used |
| `node scripts/setup.mjs --set GEMINI_API_KEY=...` | Saves one variable without prompting, then verifies it |

The script writes `.env` with permissions `600`, so only your user can read it. You don't need to restart Claude Code after changing it, because the translator reads `.env` on every run.

### Where `.env` lives after installing

`.env` stays put when the plugin runs from your clone: with `claude --plugin-dir workflows/sdlc`, or from a marketplace added by local path (`claude plugin marketplace add ./` from the repository root).

If you install the plugin from GitHub instead (`claude plugin marketplace add natserract/ai`), Claude Code copies it into a versioned cache, and each plugin update creates a fresh copy without your `.env`. Run `/sdlc:setup` again after updating, or export the key in your shell profile, which works across updates.

Never put a key in `.env.example`, because that file is committed.

## Run it by hand

```
/sdlc:translate-issue ACT-130
/sdlc:translate-issue https://linear.app/actu-al/issue/ACT-130/database-structure-audit
/sdlc:translate-issue ACT-130 --force
```

Without `--force`, the command skips an issue whose translation matches the issue's last update.

## Turn auto-translate on or off

- **Permanently:** in `/config`, set the sdlc plugin's `auto_translate` option.
- **For one shell session:** `SDLC_AUTO_TRANSLATE=1 claude`, or `SDLC_AUTO_TRANSLATE=0 claude` to turn it off.

When auto-translate is on, any prompt that contains a `linear.app/.../issue/<KEY>` URL runs the translation before Claude starts the task. Bare keys such as `ACT-130` don't trigger it, because they're easy to confuse with other text.

## Switch providers

Set `translate_provider` and `translate_model` in `/config`. To call the script directly:

```bash
node scripts/translate.mjs --in issue.md --out issue.id.md --provider claude
SDLC_TRANSLATE_PROVIDER=openrouter SDLC_TRANSLATE_MODEL=deepseek/deepseek-chat node scripts/translate.mjs --in issue.md --out issue.id.md
```

Precedence: `--provider`/`--model` flags, then `SDLC_TRANSLATE_PROVIDER`/`SDLC_TRANSLATE_MODEL`, then the provider default.

To add a provider, add an entry to `PROVIDERS` in `scripts/translate.mjs` and to the `translate_provider` options in `.claude-plugin/plugin.json`.
