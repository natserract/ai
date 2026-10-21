# Configuration

act-sdlc keeps configuration in two places:

- **Your developer profile.** Personal settings and API keys that follow you to every project.
- **The project's `act/` folder.** Settings the team shares for one repository, plus personal overrides for that repository. This folder is also where the project keeps what act-sdlc produces for it. Specs will live here too, in `act/openspec/`.

## Your developer profile

```
~/.config/act-sdlc/        # or $XDG_CONFIG_HOME/act-sdlc/
  config.json              # your defaults for every project
  .env                     # your API keys (permissions 600)
```

The profile is outside every repository and outside the plugin, so it's never committed and it survives plugin updates.

- `/act-sdlc:setup` writes `.env`.
- `/act-sdlc:config set …` writes `config.json`.

## The project's `act/` folder

Create it once per repository with `/act-sdlc:init`:

```
act/
  config.json          # team settings for this project       → commit
  .gitignore           # keeps the personal files below out of git → commit
  config.local.json    # your overrides for this project only   → gitignored
  issues/              # issue translations (<KEY>.<lang>.md)    → gitignored
```

Personal files stay out of git through `act/.gitignore`, so you don't need to edit the project's root `.gitignore`.

The plugin finds the project by walking up from the current directory. It stops at the first directory that contains `act/config.json` or `.git`, so commands work from any subdirectory.

## Which setting wins

For each key, the first layer that sets it wins:

| # | Layer | Who it's for | Set with |
| :- | :- | :- | :- |
| 1 | Command flag, e.g. `--lang in` | One run | The command itself |
| 2 | Env var, e.g. `SDLC_TRANSLATE_LANG=in` | One shell session | Your shell |
| 3 | `act/config.local.json` | You, in this project | `/act-sdlc:config set <key> <value> --local` |
| 4 | `act/config.json` | The team, in this project | `/act-sdlc:config set <key> <value> --project` |
| 5 | `~/.config/act-sdlc/config.json` | You, in every project | `/act-sdlc:config set <key> <value>` (the default scope) |
| 6 | Built-in default | Everyone | Nothing to set |

To see every key, its value, and the layer it came from, run:

```
/act-sdlc:config show
```

## Keys

| Key | Default | Env var | Meaning |
| :- | :- | :- | :- |
| `translate.language` | `id` | `SDLC_TRANSLATE_LANG` | Target language as a country code. See [the language list](translation.md#choose-a-language) |
| `translate.provider` | `gemini` | `SDLC_TRANSLATE_PROVIDER` | `gemini`, `claude`, `openai`, or `openrouter` |
| `translate.model` | empty | `SDLC_TRANSLATE_MODEL` | Model ID override. Empty uses the provider's default. Required for `openai` and `openrouter` |
| `translate.auto` | `false` | `SDLC_AUTO_TRANSLATE` | Translate automatically when a prompt contains a Linear issue URL |

`set` rejects unknown keys and invalid values, such as an unknown language code. If a config file has an unknown key, `show` prints a warning and the key is ignored.

API keys are not settings. Don't put them in any `config.json`, because `act/config.json` is committed. Keys belong in your profile `.env`; see [Set up an API key](translation.md#set-up-an-api-key).

## Team settings versus personal settings

Commit only **project facts** to `act/config.json`: things that are true for everyone working on the repository. For example, a project that always needs Japanese translations for its partner team:

```
/act-sdlc:config set translate.language jp --project
```

Keep **personal preferences** in your profile, or in `config.local.json` to override a single project:

```
/act-sdlc:config set translate.language in            # my default everywhere
/act-sdlc:config set translate.auto true              # auto-translate for me everywhere
/act-sdlc:config set translate.provider claude --local  # just me, just this repo
/act-sdlc:config unset translate.provider --local       # back to the next layer
```

`act/config.json` beats your profile. So when a team sets a key there, it applies to everyone on that project, unless someone overrides it in their own `config.local.json`.

## The config script

`/act-sdlc:config` wraps `scripts/config.mjs`. You can run the script directly from any directory in a project:

```bash
node <plugin>/scripts/config.mjs show
node <plugin>/scripts/config.mjs get translate.language
node <plugin>/scripts/config.mjs set translate.language in [--user|--project|--local]
node <plugin>/scripts/config.mjs unset translate.language [--user|--project|--local]
node <plugin>/scripts/config.mjs init
```

`set --project` and `set --local` run `init` first, so `config.local.json` is always covered by `act/.gitignore` before it's written.
