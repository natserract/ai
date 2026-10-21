---
name: translate-issue
description: Translate a Linear issue (title, description, comments) into another language, Bahasa Indonesia by default, chosen by country code (id, in, my, jp, ...), and save it to .sdlc/issues/<KEY>.<code>.md. Use for "translate ACT-130", "terjemahkan issue ini", a pasted linear.app issue URL with a translation request, or when the SDLC auto-translate hook asks for it.
argument-hint: <ISSUE-KEY | linear issue URL> [--lang <code>] [--force]
allowed-tools: Bash(node:*) Bash(mkdir:*) Write Read mcp__claude_ai_Linear__get_issue mcp__claude_ai_Linear__list_comments mcp__linear__get_issue mcp__linear__list_comments
---

# Translate a Linear issue

Arguments: `$ARGUMENTS`

## 1. Resolve the issue key

The argument is an issue key such as `ACT-130`, or a URL such as `https://linear.app/actu-al/issue/ACT-130/database-structure-audit`. Take the key from the `/issue/<KEY>/` segment of a URL. Uppercase it. If there is no argument, use the Linear issue being discussed in this conversation. If there is none, ask for a key.

`--force` means: translate even if the existing translation is current.

`--lang <code>` picks the target language by country code, such as `id` (Indonesian) or `in` (Hindi). Without it, use `${user_config.translate_language}`, or `id` if that is empty. Call the chosen code `<LANG>` below. If the user asks which codes exist, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/translate.mjs" --list-languages`.

## 2. Fetch the issue from Linear

Use the Linear MCP tools that are available: `get_issue` for the issue and `list_comments` for its comments. The tool prefix depends on how Linear is connected: `mcp__claude_ai_Linear__` for the claude.ai connector, or `mcp__linear__` for `claude mcp add`.

If no Linear MCP tool exists, or it reports that authentication is needed, stop. Tell the user to connect Linear in their claude.ai connector settings, or to run `/mcp` and authenticate the Linear server. Then retry.

## 3. Skip if already current

Read `.sdlc/issues/<KEY>.<LANG>.md` in the project root if it exists. If its frontmatter `updated_at` equals the issue's `updatedAt` and `--force` was not given, report that the translation is current, give its path, and stop.

## 4. Translate

Build the issue as Markdown in this format, leaving out any field that is empty. Pipe it into the translator with a quoted heredoc, so nothing is written to disk except the translation:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/translate.mjs" --out .sdlc/issues/<KEY>.<LANG>.md --lang <LANG> --provider "${user_config.translate_provider}" --model "${user_config.translate_model}" <<'SDLC_ISSUE_EOF'
---
key: <KEY>
url: <issue url>
updated_at: <issue updatedAt>
---
# <KEY>: <title>

- **Status:** <state>
- **Priority:** <priority>
- **Assignee:** <assignee name>
- **Labels:** <comma-separated labels>
- **Project:** <project name>

## Description

<description, unchanged Markdown>

## Comments

### <author> · <createdAt date>

<comment body>
SDLC_ISSUE_EOF
```

The frontmatter is kept untranslated in the output, which is how step 3 knows the translation is current.

An empty `--model` uses the provider's default model. If the script rejects the language code, show its error and the output of `--list-languages`. If the script fails because an API key is missing, show the script's error and tell the user to run `/act-sdlc:setup`. Do not translate the issue yourself as a fallback: the team chose an external model for this step.

## 5. Report

Give the output path, the language, provider, and model from the script's output, and a summary of the issue in the target language in 2 to 3 lines. Do not paste the whole translation into chat.

If `.sdlc/` is not in the project's `.gitignore`, say so once and suggest adding it.
