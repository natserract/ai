#!/usr/bin/env node
// Translate a Markdown file into Bahasa Indonesia with a pluggable model provider.
// Usage: node translate.mjs --in <src.md> --out <dst.md> [--provider gemini] [--model <id>]

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { loadEnv } from "./env.mjs";
import { PROVIDERS } from "./providers.mjs";

function fail(message) {
  console.error(`translate: ${message}`);
  process.exit(1);
}

// Frontmatter stays untranslated so tools can keep reading it.
function splitFrontmatter(md) {
  const match = md.match(/^---\n[\s\S]*?\n---\n/);
  return match ? [match[0], md.slice(match[0].length)] : ["", md];
}

const { values } = parseArgs({
  options: {
    in: { type: "string" },
    out: { type: "string" },
    provider: { type: "string" },
    model: { type: "string" },
  },
});
if (!values.in || !values.out) fail("usage: translate.mjs --in <src.md> --out <dst.md> [--provider <name>] [--model <id>]");

loadEnv();

const providerName = values.provider || process.env.SDLC_TRANSLATE_PROVIDER || "gemini";
const provider = PROVIDERS[providerName];
if (!provider) fail(`unknown provider "${providerName}". Use one of: ${Object.keys(PROVIDERS).join(", ")}`);

const model = values.model || process.env.SDLC_TRANSLATE_MODEL || provider.defaultModel;
if (!model) fail(`provider "${providerName}" has no default model. Pass --model or set SDLC_TRANSLATE_MODEL.`);

const key = process.env[provider.keyEnv];
if (!key) fail(`${provider.keyEnv} is not set. Run /sdlc:setup, or add it to the plugin's .env file.`);

const [frontmatter, body] = splitFrontmatter(await readFile(values.in, "utf8"));
const translated = await provider.translate({ key, model, text: body }).catch((err) => fail(err.message));
if (!translated?.trim()) fail(`${providerName}/${model} returned an empty translation.`);

const header = frontmatter
  ? frontmatter.replace(/\n---\n$/, `\nlang: id\ntranslated_by: ${providerName}/${model}\n---\n`)
  : "";
await mkdir(dirname(values.out), { recursive: true });
await writeFile(values.out, `${header}${translated.trim()}\n`);
console.log(`${values.out} (${providerName}/${model})`);
