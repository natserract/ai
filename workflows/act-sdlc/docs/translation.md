# Linear issue translation

`/act-sdlc:translate-issue` reads a Linear issue (title, metadata, description, comments) through the Linear MCP and writes one file to the project: `act/issues/<KEY>.<lang>.md`. The language is chosen by country code and defaults to `id` (Bahasa Indonesia), so the default output is `act/issues/<KEY>.id.md`. The original stays in Linear and isn't saved.

Claude fetches the issue and pipes it to the translator. A separate model does the translation through `scripts/translate.mjs`. Code, URLs, identifiers, and common technical terms are left in English.

Run `/act-sdlc:init` once in the project, so `act/issues/` stays out of git. For settings and the `act/` folder, see [configuration.md](configuration.md).

## Set up an API key

The translator reads API keys from your developer profile, at `~/.config/act-sdlc/.env` (or `$XDG_CONFIG_HOME/act-sdlc/.env`). The file is outside every repository and survives plugin updates. If a key is also exported in your shell, the shell value is used.

| Provider | Env var | Default model | Get a key |
| :- | :- | :- | :- |
| `gemini` (default) | `GEMINI_API_KEY` | `gemini-3.8-flash` | https://aistudio.google.com/apikey |
| `claude` | `ANTHROPIC_API_KEY` | `claude-sonnet-5-5` | https://console.anthropic.com |
| `openai` | `OPENAI_API_KEY` | none: set `translate.model` | https://platform.openai.com/api-keys |
| `openrouter` | `OPENROUTER_API_KEY` | none: set `translate.model`, e.g. `google/gemini-3.8-flash` | https://openrouter.ai/keys |

### Option 1: guided setup (recommended)

In Claude Code, run:

```
/act-sdlc:setup
```

It shows which keys are set, explains how to add the missing one, and verifies the key with a free API call. `/act-sdlc:setup claude` sets up a provider other than your configured one.

You can also run the setup script yourself in a terminal. It hides the key while you paste it:

```bash
node <plugin>/scripts/setup.mjs
```

`<plugin>` is the plugin folder: `workflows/act-sdlc` in a clone of the repository. `/act-sdlc:setup` prints the full path for you.

### Option 2: edit `.env` by hand

```bash
mkdir -p ~/.config/act-sdlc
cp <plugin>/.env.example ~/.config/act-sdlc/.env
chmod 600 ~/.config/act-sdlc/.env
# then fill in the line for your provider, e.g. GEMINI_API_KEY=AIza...
node <plugin>/scripts/setup.mjs --check
```

### Setup script reference

| Command | What it does |
| :- | :- |
| `node scripts/setup.mjs` | Asks for a provider and key (hidden input), saves it to your profile `.env`, and verifies it |
| `node scripts/setup.mjs --status` | Lists each provider's key: not set, or set from the shell or `.env` (last 4 characters only) |
| `node scripts/setup.mjs --check [--provider gemini]` | Calls each configured provider's model list endpoint to confirm its key works. No tokens are used |
| `node scripts/setup.mjs --set GEMINI_API_KEY=...` | Saves one variable without prompting, then verifies it |

The script writes `.env` with permissions `600`, so only your user can read it. You don't need to restart Claude Code after changing it, because the translator reads `.env` on every run.

Never put a key in `.env.example` or in any `config.json`. Both can be committed.

## Run it by hand

```
/act-sdlc:translate-issue ACT-130
/act-sdlc:translate-issue https://linear.app/actu-al/issue/ACT-130/database-structure-audit
/act-sdlc:translate-issue ACT-130 --lang in
/act-sdlc:translate-issue ACT-130 --force
```

The translator skips the API call when the existing translation in that language was made from the issue's current revision (same `updated_at`). `--force` translates anyway. Each language gets its own file, so `ACT-130.id.md` and `ACT-130.in.md` can sit side by side.

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

To use a language for one run, pass `--lang`. To change your default, set `translate.language`:

```
/act-sdlc:config set translate.language in             # you, every project
/act-sdlc:config set translate.language jp --project   # the team, this project
```

See [which setting wins](configuration.md#which-setting-wins).

To add a language, add a row to `LANGUAGES` in `scripts/languages.mjs`.

## Turn auto-translate on or off

```
/act-sdlc:config set translate.auto true            # on for you, every project
/act-sdlc:config set translate.auto false --local   # off for you, in this project
```

For one shell session, use `SDLC_AUTO_TRANSLATE=1 claude` (on) or `SDLC_AUTO_TRANSLATE=0 claude` (off).

When auto-translate is on, any prompt that contains a `linear.app/.../issue/<KEY>` URL runs the translation before Claude starts the task. Bare keys such as `ACT-130` don't trigger it, because they're easy to confuse with other text.

## Switch providers

```
/act-sdlc:config set translate.provider claude
/act-sdlc:config set translate.provider openrouter
/act-sdlc:config set translate.model deepseek/deepseek-chat
```

Then run `/act-sdlc:setup` to add that provider's key.

To call the script directly:

```bash
node scripts/translate.mjs --in issue.md --provider claude              # writes act/issues/<key>.<lang>.md
node scripts/translate.mjs --in issue.md --out issue.in.md --lang in   # explicit output path
cat issue.md | node scripts/translate.mjs                               # --in is optional; stdin works too
```

Without `--out`, the source needs a `key:` field in its frontmatter. Flags win over every config layer.

To add a provider, add an entry to `PROVIDERS` in `scripts/providers.mjs`. `translate.provider` accepts it automatically.
