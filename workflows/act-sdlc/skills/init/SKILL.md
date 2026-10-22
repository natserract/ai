---
name: init
description: Set up your act-sdlc workspace (~/.act/), where RFC drafts, exports, and translations live on your machine, outside every repo. Once per machine. Use for /act-sdlc:init, "set up act-sdlc", or when another act-sdlc command says the workspace is missing.
allowed-tools: Bash(node:*)
---

# Set up your act-sdlc workspace

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" init
```

It creates whichever parts are missing, and never overwrites anything:

```
~/.act/                  # your workspace ($ACT_HOME to move it); never in any git repo
  openspec/
    config.yaml          # OpenSpec context and rules; starts with act-sdlc's Call Graph rules
    changes/<id>/        # RFC drafts, one per issue (from /act-sdlc:to-spec)
  rfc/<KEY>.md           # English RFCs, as published to Linear
  rfc/<KEY>.<lang>.md    # your translations of them (local only)
  issues/<KEY>.<lang>.md # issue translations (created on translate)
```

The workspace is created with a pinned OpenSpec CLI run through `npx`, with OpenSpec's own slash commands turned off. The first run downloads the CLI, which can take a moment.

App repositories are never touched. The shared copy of every spec is the `RFC:` document on the Linear issue, which `/act-sdlc:to-spec` publishes.

## Report

- List what was created, or say the workspace was already set up.
- Say that the `rules:` block in `~/.act/openspec/config.yaml` is theirs to edit. It holds act-sdlc's Call Graph Planning defaults; see `${CLAUDE_PLUGIN_ROOT}/docs/call-graph.md`. A `context:` block there can hold constraints every RFC should respect, such as the stack.
- Tell them to continue with `/act-sdlc:to-spec <KEY>` for an issue, and to run `/act-sdlc:setup` if translation isn't set up yet.
- If the current repo still has a `.act/` folder from an earlier version of act-sdlc, say it's no longer used and can be deleted.
