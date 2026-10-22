# Configuration

Everything act-sdlc keeps is on your machine, in two places, and **app repositories are never touched**:

```
~/.config/act-sdlc/         # your profile ($XDG_CONFIG_HOME/act-sdlc)
  config.json               # your settings
  .env                      # your API keys (permissions 600)

~/.act/                     # your workspace ($ACT_HOME to move it)
  openspec/                 # RFC drafts, validated with OpenSpec
    config.yaml             # rules every draft follows (Call Graph Planning by default)
    changes/<id>/           # one draft per issue
  rfc/<KEY>.md              # English RFCs, as published to Linear
  rfc/<KEY>.<lang>.md       # your translations of them (local only, never published)
  issues/<KEY>.<lang>.md    # issue translations
```

The shared copy of each spec is the `RFC:` document on the Linear issue. See [lifecycle.md](lifecycle.md).

- `/act-sdlc:init` creates the workspace.
- `/act-sdlc:setup` writes `.env`.
- `/act-sdlc:config set …` writes `config.json`.

## Which setting wins

For each key, the first one that's set wins:

| # | Source | Example |
| :- | :- | :- |
| 1 | Command flag | `--lang in` |
| 2 | Env var | `SDLC_TRANSLATE_LANG=in claude` |
| 3 | Your profile | `/act-sdlc:config set translate.language in` |
| 4 | Built-in default | `id` |

To see every key, its value, and where it came from, run:

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
| `phases.lightLabels` | `Small Size` | `SDLC_LIGHT_LABELS` | Comma-separated Linear labels whose issues take the [light path](lifecycle.md#the-light-path) |
| `phases.callGraph` | `true` | `SDLC_CALL_GRAPH` | Full-path RFCs must have a [Call Graph](call-graph.md). `false` drops the `/status` gate |
| `start.skills` | empty | `SDLC_START_SKILLS` | Comma-separated skills `/start` invokes for every code task, in order: implementation skills first, review skills last. Example: `pstack:tdd,code-review` |
| `plan.autoSplit` | `true` | `SDLC_PLAN_AUTO_SPLIT` | `/plan` creates decision and work sub-issues in Linear when an issue is too large. `false` shows the proposed map in chat only |
| `rfc.publish` | `true` | `SDLC_RFC_PUBLISH` | `/to-spec` creates or updates the issue's `RFC:` document in Linear and adds a notification comment. `false` keeps RFCs local |

`set` rejects unknown keys and invalid values. If `config.json` contains an unknown key, `show` prints a warning and the key is ignored.

API keys are not settings: they belong in your profile `.env`. See [Set up an API key](translation.md#set-up-an-api-key).

## Team conventions

There are no team or per-repo settings files, so nothing lands in app repos. Teams agree on conventions in two places:

- **The RFC itself, in Linear:** what each issue will do, reviewed by everyone.
- **Workspace rules:** the `rules:` and `context:` blocks in `~/.act/openspec/config.yaml` decide what every draft must contain. To share a convention, share the snippet; each developer pastes it into their own workspace. The defaults that `/act-sdlc:init` writes are the same for everyone.

## The config script

`/act-sdlc:config` wraps `scripts/config.mjs`:

```bash
node <plugin>/scripts/config.mjs show
node <plugin>/scripts/config.mjs get translate.language
node <plugin>/scripts/config.mjs set translate.language in
node <plugin>/scripts/config.mjs unset translate.language
node <plugin>/scripts/config.mjs init        # create ~/.act/
```
