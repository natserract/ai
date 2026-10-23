---
name: help
description: Show every act-sdlc command grouped by use, your setup (workspace, API key, key settings), and a suggested next step for the repo and branch you're in. With a command name, show that command's usage in detail. Use for /act-sdlc:help, "what can act-sdlc do", "which act-sdlc commands are there", "how do I use /act-sdlc:start", or "act-sdlc help".
argument-hint: "[command]"
allowed-tools: Bash(node:*)
---

# act-sdlc help

Arguments: `$ARGUMENTS`

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/help.mjs" [command]
```

Pass the command name if the user gave one, with or without the `/act-sdlc:` prefix.

Show the output as it is, in a code block. Then add at most two lines:
- If the setup shows `✗` for the workspace, offer to run `/act-sdlc:init`.
- If "Here" names an issue from the branch, offer to run `/act-sdlc:status <issue>`.

For a single command, after the code block, offer to run it if the user seems ready to. Don't repeat the whole skill file; point to it if they want the full steps.
