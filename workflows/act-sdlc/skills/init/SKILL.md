---
name: init
description: Set up the act/ folder in the current project, where the project keeps its team config and act-sdlc output. Use for /act-sdlc:init, "init act-sdlc in this repo", or "set up this project for act-sdlc".
allowed-tools: Bash(node:*) Bash(git status:*)
---

# Set up this project for act-sdlc

Run from the project directory:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" init
```

It creates whichever of these files are missing, and never overwrites existing ones:

```
act/
  config.json   # team settings for this project: commit this
  .gitignore    # keeps config.local.json and issues/ out of git
```

Personal files the plugin writes later stay out of git through `act/.gitignore`:
- `act/config.local.json`: your own overrides for this project.
- `act/issues/`: issue translations.

## Report

- List the files that were created, or say the project was already set up.
- Tell the user to commit `act/config.json` and `act/.gitignore`. Then `/act-sdlc:config set <key> <value> --project` sets team defaults, and `--local` sets their own overrides.
- If an old `.sdlc/issues/` folder exists in the project root, mention that translations now go to `act/issues/`, and that the old folder can be deleted.
