#!/usr/bin/env node
// UserPromptSubmit hook: when translate.auto is on for this project and the prompt links a Linear
// issue, tell Claude to run the translate-issue skill. Hooks can't call MCP, so the skill fetches.
// Never blocks the prompt: any failure exits 0 with no output.

import { loadConfig } from "../scripts/config.mjs";

const ISSUE_URL = /https?:\/\/linear\.app\/[^/\s]+\/issue\/([A-Za-z][A-Za-z0-9]*-\d+)/g;

try {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const { prompt = "", cwd } = JSON.parse(input);

  const keys = [...new Set([...prompt.matchAll(ISSUE_URL)].map((m) => m[1].toUpperCase()))];
  if (keys.length === 0 || !loadConfig(cwd || process.cwd()).values["translate.auto"]) process.exit(0);

  const list = keys.join(", ");
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext:
        `act-sdlc auto-translate is on. The prompt links Linear issue(s) ${list}. ` +
        `Before other work, the act-sdlc:translate-issue skill runs once for each key (${list}) ` +
        `in the configured translation language. The translator skips issues whose translation is already current.`,
    },
  }));
} catch {
  process.exit(0);
}
