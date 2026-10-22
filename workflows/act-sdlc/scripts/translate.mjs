#!/usr/bin/env node
// Translate a Markdown file into another language with a pluggable model provider.
// Usage: node translate.mjs [--in <src.md>] [--out <dst.md>] [--lang id] [--provider gemini] [--model <id>] [--force]
//        node translate.mjs --list-languages
// Without --in, the source Markdown is read from stdin. Without --out, the output goes to
// ~/.act/issues/<key>.<lang>.md (the workspace), using `key:` from the source frontmatter.
// Language, provider, and model fall back to the layered config (see config.mjs).

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { loadConfig, workspaceDir } from "./config.mjs";
import { loadEnv } from "./env.mjs";
import { LANGUAGES, resolveLanguage } from "./languages.mjs";
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

const field = (frontmatter, name) => frontmatter.match(new RegExp(`^${name}:\\s*(.+?)\\s*$`, "m"))?.[1];

const { values } = parseArgs({
  options: {
    in: { type: "string" },
    out: { type: "string" },
    lang: { type: "string" },
    "list-languages": { type: "boolean" },
    provider: { type: "string" },
    model: { type: "string" },
    force: { type: "boolean" },
  },
});
if (values["list-languages"]) {
  for (const [code, name] of Object.entries(LANGUAGES)) console.log(`${code}  ${name}`);
  process.exit(0);
}

loadEnv();
let config;
try {
  config = loadConfig();
} catch (err) {
  fail(err.message);
}

const languageCode = values.lang || config.values["translate.language"];
const language = resolveLanguage(languageCode);
if (!language) fail(`unknown language code "${languageCode}". Run with --list-languages to see the supported codes.`);

const providerName = values.provider || config.values["translate.provider"];
const provider = PROVIDERS[providerName];
if (!provider) fail(`unknown provider "${providerName}". Use one of: ${Object.keys(PROVIDERS).join(", ")}`);

const model = values.model || config.values["translate.model"] || provider.defaultModel;
if (!model) fail(`provider "${providerName}" has no default model. Set translate.model with /act-sdlc:config, or pass --model.`);

const source = values.in ? await readFile(values.in, "utf8") : await readStdin();
if (!source.trim()) fail("no source text: pass --in <file> or pipe Markdown on stdin.");
const [frontmatter, body] = splitFrontmatter(source);

const issueKey = field(frontmatter, "key");
if (!values.out && !issueKey) fail("pass --out, or give the source a `key:` field in its frontmatter.");
const out = values.out || join(workspaceDir(), "issues", `${issueKey}.${language.code}.md`);
const shown = out;

// Skip when the existing translation was made from exactly this source text and language.
const sourceSha = createHash("sha256").update(`${language.code}\n${source}`).digest("hex").slice(0, 16);
if (!values.force && existsSync(out)) {
  const [existing] = splitFrontmatter(await readFile(out, "utf8"));
  if (field(existing, "source_sha") === sourceSha) {
    console.log(`current: ${shown} (source unchanged; pass --force to redo)`);
    process.exit(0);
  }
}

const key = process.env[provider.keyEnv];
if (!key) fail(`${provider.keyEnv} is not set. Run /act-sdlc:setup.`);

const translated = await provider.translate({ key, model, system: systemPrompt(language.name), text: body }).catch((err) => fail(err.message));
if (!translated?.trim()) fail(`${providerName}/${model} returned an empty translation.`);

const meta = `lang: ${language.code}\ntranslated_by: ${providerName}/${model}\nsource_sha: ${sourceSha}\n`;
const header = frontmatter ? frontmatter.replace(/\n---\n$/, `\n${meta}---\n`) : `---\n${meta}---\n\n`;
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${header}${translated.trim()}\n`);
console.log(`${shown} (${language.name}, ${providerName}/${model})`);
