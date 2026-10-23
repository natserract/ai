# natserract/ai

My AI kit: the tools, experiments, projects, and findings from working with AI day to day. Some of it is used every day, and some is just an experiment. Expect things to change.

## What's here

| Area | What's in it | Status |
| :- | :- | :- |
| [**Workflows**](workflows) | Claude Code plugins that encode how I work with AI | In use |
| Experiments | Prototypes and try-outs of models, prompts, and agent patterns | Coming |
| Projects | Bigger builds that grew out of experiments | Coming |
| Findings | Notes on what worked, what didn't, and why | Coming |

### Workflows

| Plugin | What it does |
| :- | :- |
| [**act-sdlc**](workflows/act-sdlc) | Takes work from a Linear issue through the whole development cycle. That covers triage, a reviewed RFC, building task by task, verification with a security review, and PR reviews, plus translating issues and RFCs. |

## Using the plugins

This repo is also a Claude Code plugin marketplace, called **`actual`**:

```bash
claude plugin marketplace add natserract/ai
claude plugin install act-sdlc@actual
```

Restart Claude Code, then follow the plugin's [Quick start](workflows/act-sdlc/README.md#quick-start). To update later, run `claude plugin marketplace update actual`.

To try a plugin straight from a clone, without installing it:

```bash
git clone https://github.com/natserract/ai.git
cd ai
claude --plugin-dir ./workflows/act-sdlc
```

**Raise the plugin's `version` with every change.** Claude Code caches each installed plugin by its version. If the files change but the version doesn't, everyone keeps the old copy. A pre-commit hook enforces this; turn it on once per clone:

```bash
git config core.hooksPath .githooks
```

It refuses a commit that changes `workflows/<plugin>/` (other than its READMEs) without a higher `version` in that plugin's `plugin.json`.

Before pushing plugin changes, check both the marketplace and the plugin:

```bash
claude plugin validate .
claude plugin validate workflows/act-sdlc
```

## Layout

```
.
├── .claude-plugin/marketplace.json   # the "actual" plugin marketplace
└── workflows/                        # Claude Code plugins, one folder each
    └── act-sdlc/
```

New areas (`experiments/`, `projects/`, `findings/`) get their own top-level folder when they first appear.

## Note

This is a personal workspace. Things here are opinionated and evolve quickly, and some are experimental. Use whatever helps, but check a plugin's README for its requirements and what it changes before you rely on it.
