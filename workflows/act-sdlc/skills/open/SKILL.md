---
name: open
description: Open an issue's RFC. By default it opens your local translation in your default language (synced from the English RFC in Linear and translated first if needed); --en opens the English copy, --linear opens the Linear document in the browser, --print shows it in chat. Use for /act-sdlc:open, "open the RFC for ACT-95", "buka RFC ACT-95", or "show me the spec in Indonesian".
argument-hint: <ISSUE-KEY | linear issue URL> [--en] [--lang <code>] [--linear] [--print]
allowed-tools: Bash(node:*) mcp__claude_ai_Linear__get_issue mcp__claude_ai_Linear__get_document mcp__linear__get_issue mcp__linear__get_document
---

# Open an issue's RFC

Arguments: `$ARGUMENTS`

**Where each copy lives:**
- Linear holds the English RFC.
- `~/.act/rfc/<KEY>.md` is a local copy of that English text.
- `~/.act/rfc/<KEY>.<lang>.md` is your translation into `translate.language`. It is **local only and never published to Linear**.

This command only reads Linear.

Shorthand: `RFC` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs"`.

## 1. Resolve the key and options

The argument is an issue key such as `ACT-95`, or a Linear URL containing `/issue/<KEY>/`. Uppercase the key.

Options:
- `--en`: the English RFC instead of your translation.
- `--lang <code>`: a translation into another language for this run.
- `--linear`: open the Linear document in the browser.
- `--print`: show the document in chat instead of opening an app.

## 2. Get the latest RFC from Linear

1. Read the issue with `get_issue` (prefix `mcp__claude_ai_Linear__` or `mcp__linear__`), with `documents`.
2. Find the document whose title starts with `RFC:`. If there are several, take the most recently updated one.
3. **With `--linear`:** run `RFC open-url <document url>`, report it, and stop.
4. Read the document with `get_document`, then store its content as the English copy:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs" sync <KEY> <<'ACT_RFC_EOF'
   <document content, unchanged>
   ACT_RFC_EOF
   ```

If Linear isn't connected, or the issue has no `RFC:` document, fall back to the local copy when `~/.act/rfc/<KEY>.md` exists, and say it may be out of date. If there's no local copy either, suggest `/act-sdlc:to-spec <KEY>` and stop.

## 3. Translate (unless `--en`)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs" translate <KEY> [--lang <code>]
```

- It prints `current:` and makes no API call when the English text hasn't changed.
- It prints `skipped:` when your language is English.
- If it fails because an API key is missing, say so, point to `/act-sdlc:setup`, and fall back to opening the English copy.

## 4. Open

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/rfc.mjs" open <KEY> [--en] [--lang <code>] [--print]
```

- **Without `--print`:** the file opens in the system's default app for Markdown. Report the path in one line.
- **With `--print`:** show the printed document in chat exactly as written, without its frontmatter block. Don't summarize or re-translate it.
