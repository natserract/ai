---
name: translate-issue
description: Translate a Linear issue (title, description, comments) into another language, Bahasa Indonesia by default, chosen by country code (id, in, my, jp, ...), and save it to ~/.act/issues/<KEY>.<code>.md in your workspace. Use for "translate ACT-130", "terjemahkan issue ini", a pasted linear.app issue URL with a translation request, or when the act-sdlc auto-translate hook asks for it.
argument-hint: <ISSUE-KEY | linear issue URL> [--lang <code>] [--force] [--summary]
allowed-tools: Bash(node:*) Read mcp__claude_ai_Linear__get_issue mcp__claude_ai_Linear__list_comments mcp__linear__get_issue mcp__linear__list_comments
---

# Translate a Linear issue

Arguments: `$ARGUMENTS`

## 1. Resolve the issue key and options

The argument is an issue key such as `ACT-130`, or a URL such as `https://linear.app/actu-al/issue/ACT-130/database-structure-audit`. Take the key from the `/issue/<KEY>/` segment of a URL. Uppercase it. If there is no argument, use the Linear issue being discussed in this conversation. If there is none, ask for a key.

Pass these through to the translator unchanged when given:
- `--lang <code>`: the target language by country code, such as `id` (Indonesian) or `in` (Hindi). Without it, the translator uses the configured `translate.language` (see `/act-sdlc:config`). If the user asks which codes exist, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/translate.mjs" --list-languages`.
- `--force`: translate even if the existing translation is current.
- `--summary`: show only a short summary in chat, not the full translation. This one is for this skill only; don't pass it to the translator.

## 2. Fetch the issue from Linear

Use the Linear MCP tools that are available: `get_issue` for the issue and `list_comments` for its comments. The tool prefix depends on how Linear is connected: `mcp__claude_ai_Linear__` for the claude.ai connector, or `mcp__linear__` for `claude mcp add`.

If no Linear MCP tool exists, or it reports that authentication is needed, stop. Tell the user to connect Linear in their claude.ai connector settings, or to run `/mcp` and authenticate the Linear server. Then retry.

## 3. Translate

Build the issue as Markdown in this format, leaving out any field that is empty. Pipe it into the translator with a quoted heredoc. Add `--lang <code>` and `--force` only if the user gave them.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/translate.mjs" [--lang <code>] [--force] <<'SDLC_ISSUE_EOF'
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

The translator writes `~/.act/issues/<KEY>.<lang>.md` in your workspace, outside every repo, and prints the path. If the existing translation was made from exactly the same source text, it prints `current: <path>` and skips the API call. A new comment or an edit counts as a change.

If the script fails:
- **Missing API key:** show its error and tell the user to run `/act-sdlc:setup`.
- **Unknown language code:** show its error and the output of `--list-languages`.
- **Invalid config file:** show its error, which names the file.

Do not translate the issue yourself as a fallback: the team chose an external model for this step.

## 4. Report

Read the translation file at the path the script printed. For a `current:` result, that's the existing file.

By default, **show the full translation in chat**:
1. One line with the source: the language, provider, and model (or "already up to date"), and the file path.
2. The translated Markdown exactly as written in the file, without the frontmatter block at the top. Don't summarize it, shorten it, or re-translate it.

Show only a 2 to 3 line summary in the target language, plus the file path, when either of these is true:
- the user passed `--summary`;
- this run was started by the act-sdlc auto-translate hook rather than requested directly, so the user's actual task stays in focus.

