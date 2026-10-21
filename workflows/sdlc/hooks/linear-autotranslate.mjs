#!/usr/bin/env node
// UserPromptSubmit hook: when auto-translate is on and the prompt links a Linear issue,
// tell Claude to run the translate-issue skill. Hooks can't call MCP, so the skill fetches.
// Never blocks the prompt: any failure exits 0 with no output.

const ISSUE_URL = /https?:\/\/linear\.app\/[^/\s]+\/issue\/([A-Za-z][A-Za-z0-9]*-\d+)/g;

function autoTranslateEnabled() {
  const value = process.env.SDLC_AUTO_TRANSLATE ?? process.env.CLAUDE_PLUGIN_OPTION_AUTO_TRANSLATE ?? "";
  return ["true", "1", "on"].includes(value.toLowerCase());
}

try {
  if (!autoTranslateEnabled()) process.exit(0);

  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const { prompt = "" } = JSON.parse(input);

  const keys = [...new Set([...prompt.matchAll(ISSUE_URL)].map((m) => m[1].toUpperCase()))];
  if (keys.length === 0) process.exit(0);

  const list = keys.join(", ");
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext:
        `SDLC auto-translate is on. The prompt links Linear issue(s) ${list}. ` +
        `Before other work, the sdlc:translate-issue skill runs once for each key (${list}), ` +
        `producing .sdlc/issues/<KEY>.id.md. The skill skips issues whose translation is already current.`,
    },
  }));
} catch {
  process.exit(0);
}
