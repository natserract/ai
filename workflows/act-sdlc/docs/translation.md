# Linear issue translation

`/act-sdlc:translate-issue` reads a Linear issue (title, metadata, description, comments) through the Linear MCP and writes one file to the project: `.sdlc/issues/<KEY>.<lang>.md`, the translation. The language is chosen by country code and defaults to `id` (Bahasa Indonesia), so the default output is `.sdlc/issues/<KEY>.id.md`. The original stays in Linear and isn't saved.

Claude fetches the issue and pipes it to the translator. A separate model does the translation through `scripts/translate.mjs`. Code, URLs, identifiers, and common technical terms are left in English.

Add `.sdlc/` to your project's `.gitignore`.

## Set up an API key

The translator reads API keys from `.env` at the plugin root (`workflows/act-sdlc/.env`). This file is gitignored. If a key is also exported in your shell, the shell value is used.

| Provider | Env var | Default model | Get a key |
| :- | :- | :- | :- |
| `gemini` (default) | `GEMINI_API_KEY` | `gemini-3.8-flash` | https://aistudio.google.com/apikey |
| `claude` | `ANTHROPIC_API_KEY` | `claude-sonnet-5-5` | https://console.anthropic.com |
| `openai` | `OPENAI_API_KEY` | none: set `translate_model` | https://platform.openai.com/api-keys |
| `openrouter` | `OPENROUTER_API_KEY` | none: set `translate_model`, e.g. `google/gemini-3.8-flash` | https://openrouter.ai/keys |

### Option 1: guided setup (recommended)

In Claude Code, run:

```
/act-sdlc:setup
```

It shows which keys are set, explains how to add the missing one, and verifies the key with a free API call. `/act-sdlc:setup claude` sets up a provider other than the one in your config.

You can also run the setup script yourself in a terminal. It hides the key while you paste it:

```bash
node workflows/act-sdlc/scripts/setup.mjs
```

### Option 2: edit `.env` by hand

```bash
cp workflows/act-sdlc/.env.example workflows/act-sdlc/.env
# then fill in the line for your provider, e.g. GEMINI_API_KEY=AIza...
node workflows/act-sdlc/scripts/setup.mjs --check
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

`.env` stays put when the plugin runs from your clone: with `claude --plugin-dir workflows/act-sdlc`, or from a marketplace added by local path (`claude plugin marketplace add ./` from the repository root).

If you install the plugin from GitHub instead (`claude plugin marketplace add natserract/ai`), Claude Code copies it into a versioned cache, and each plugin update creates a fresh copy without your `.env`. Run `/act-sdlc:setup` again after updating, or export the key in your shell profile, which works across updates.

Never put a key in `.env.example`, because that file is committed.

## Run it by hand

```
/act-sdlc:translate-issue ACT-130
/act-sdlc:translate-issue https://linear.app/actu-al/issue/ACT-130/database-structure-audit
/act-sdlc:translate-issue ACT-130 --lang in
/act-sdlc:translate-issue ACT-130 --force
```

Without `--force`, the command skips an issue whose translation in that language matches the issue's last update. Each language gets its own file, so `ACT-130.id.md` and `ACT-130.in.md` can sit side by side.

## Choose a language

Languages are chosen by **country code**. A country with several languages maps to its most common working language.

| Code | Language | Code | Language |
| :- | :- | :- | :- |
| `id` (default) | Indonesian (Bahasa Indonesia) | `cn` | Simplified Chinese |
| `in` | Hindi | `tw` | Traditional Chinese |
| `my` | Malay (Bahasa Melayu) | `sa` | Arabic |
| `sg` | English | `us` | English |
| `ph` | Filipino | `gb` | British English |
| `th` | Thai | `de` | German |
| `vn` | Vietnamese | `fr` | French |
| `jp` | Japanese | `es` | Spanish |
| `kr` | Korean | `br` | Brazilian Portuguese |
| | | `nl` | Dutch |

The script prints the current list:

```bash
node scripts/translate.mjs --list-languages
```

How the language is picked, first match wins:

1. `--lang <code>` on the command, e.g. `/act-sdlc:translate-issue ACT-130 --lang in`.
2. The `translate_language` option in `/config`. Auto-translate uses this one.
3. `SDLC_TRANSLATE_LANG` in your shell or `.env`, when you call the script directly.
4. `id`.

To add a language, add a row to `LANGUAGES` in `scripts/languages.mjs`.

## Turn auto-translate on or off

- **Permanently:** in `/config`, set the act-sdlc plugin's `auto_translate` option.
- **For one shell session:** `SDLC_AUTO_TRANSLATE=1 claude`, or `SDLC_AUTO_TRANSLATE=0 claude` to turn it off.

When auto-translate is on, any prompt that contains a `linear.app/.../issue/<KEY>` URL runs the translation before Claude starts the task. Bare keys such as `ACT-130` don't trigger it, because they're easy to confuse with other text.

## Switch providers

Set `translate_provider` and `translate_model` in `/config`. To call the script directly:

```bash
node scripts/translate.mjs --in issue.md --out issue.id.md --provider claude
node scripts/translate.mjs --in issue.md --out issue.in.md --lang in
cat issue.md | node scripts/translate.mjs --out issue.id.md   # --in is optional; stdin works too
SDLC_TRANSLATE_PROVIDER=openrouter SDLC_TRANSLATE_MODEL=deepseek/deepseek-chat node scripts/translate.mjs --in issue.md --out issue.id.md
```

Precedence: `--provider`/`--model` flags, then `SDLC_TRANSLATE_PROVIDER`/`SDLC_TRANSLATE_MODEL`, then the provider default.

To add a provider, add an entry to `PROVIDERS` in `scripts/providers.mjs` and to the `translate_provider` options in `.claude-plugin/plugin.json`.
