#!/usr/bin/env node
// Translate a Markdown file into another language with a pluggable model provider.
// Usage: node translate.mjs [--in <src.md>] --out <dst.md> [--lang id] [--provider gemini] [--model <id>]
//        node translate.mjs --list-languages
// Without --in, the source Markdown is read from stdin. --lang takes a country code from languages.mjs.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { loadEnv } from "./env.mjs";
import { DEFAULT_LANGUAGE, LANGUAGES, resolveLanguage } from "./languages.mjs";
import { PROVIDERS, systemPrompt } from "./providers.mjs";

function fail(message) {
  console.error(`translate: ${message}`);
  process.exit(1);
}

async function readStdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
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
    lang: { type: "string" },
    "list-languages": { type: "boolean" },
    provider: { type: "string" },
    model: { type: "string" },
  },
});
if (values["list-languages"]) {
  for (const [code, name] of Object.entries(LANGUAGES)) console.log(`${code}  ${name}`);
  process.exit(0);
}
if (!values.out) fail("usage: translate.mjs [--in <src.md>] --out <dst.md> [--lang <code>] [--provider <name>] [--model <id>]");

loadEnv();

const languageCode = values.lang || process.env.SDLC_TRANSLATE_LANG || DEFAULT_LANGUAGE;
const language = resolveLanguage(languageCode);
if (!language) fail(`unknown language code "${languageCode}". Run with --list-languages to see the supported codes.`);

const providerName = values.provider || process.env.SDLC_TRANSLATE_PROVIDER || "gemini";
const provider = PROVIDERS[providerName];
if (!provider) fail(`unknown provider "${providerName}". Use one of: ${Object.keys(PROVIDERS).join(", ")}`);

const model = values.model || process.env.SDLC_TRANSLATE_MODEL || provider.defaultModel;
if (!model) fail(`provider "${providerName}" has no default model. Pass --model or set SDLC_TRANSLATE_MODEL.`);

const key = process.env[provider.keyEnv];
if (!key) fail(`${provider.keyEnv} is not set. Run /act-sdlc:setup, or add it to the plugin's .env file.`);

const source = values.in ? await readFile(values.in, "utf8") : await readStdin();
if (!source.trim()) fail("no source text: pass --in <file> or pipe Markdown on stdin.");
const [frontmatter, body] = splitFrontmatter(source);
const translated = await provider.translate({ key, model, system: systemPrompt(language.name), text: body }).catch((err) => fail(err.message));
if (!translated?.trim()) fail(`${providerName}/${model} returned an empty translation.`);

const header = frontmatter
  ? frontmatter.replace(/\n---\n$/, `\nlang: ${language.code}\ntranslated_by: ${providerName}/${model}\n---\n`)
  : "";
await mkdir(dirname(values.out), { recursive: true });
await writeFile(values.out, `${header}${translated.trim()}\n`);
console.log(`${values.out} (${language.name}, ${providerName}/${model})`);
