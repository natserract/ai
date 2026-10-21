// Translation providers. Each one names its API key env var, an optional default model,
// a translate() call, and a check() that confirms the key works without spending tokens.

export const systemPrompt = (language) => `You translate software engineering issues into ${language}.

Write natural, professional ${language} the way a software engineer who works in ${language} writes in a work tracker. Do not translate word for word. Parts already written in ${language} stay as they are.

Keep these exactly as they are:
- Markdown structure: headings, lists, tables, links, emphasis.
- Code blocks, inline code, file paths, commands, and URLs.
- Identifiers, issue keys (e.g. ACT-130), @mentions, people's names, and product names.
- Technical terms that engineers writing in ${language} normally leave in English, such as database, endpoint, migration, schema, query, deploy, branch, and pull request.

Output only the translated Markdown. Add no preamble, notes, or code fences around the whole answer.`;

export const PROVIDERS = {
  gemini: {
    keyEnv: "GEMINI_API_KEY",
    defaultModel: "gemini-3.8-flash",
    async translate({ key, model, system, text }) {
      const body = await request(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { "x-goog-api-key": key },
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text }] }],
        },
      );
      return body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    },
    check: (key) => request("https://generativelanguage.googleapis.com/v1beta/models", { "x-goog-api-key": key }),
  },
  claude: {
    keyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-5-5",
    async translate({ key, model, system, text }) {
      const body = await request(
        "https://api.anthropic.com/v1/messages",
        anthropicHeaders(key),
        { model, max_tokens: 16000, system, messages: [{ role: "user", content: text }] },
      );
      return body.content?.filter((b) => b.type === "text").map((b) => b.text).join("");
    },
    check: (key) => request("https://api.anthropic.com/v1/models", anthropicHeaders(key)),
  },
  openai: {
    keyEnv: "OPENAI_API_KEY",
    translate: ({ key, model, system, text }) => chatCompletion("https://api.openai.com/v1/chat/completions", key, model, system, text),
    check: (key) => request("https://api.openai.com/v1/models", bearer(key)),
  },
  openrouter: {
    keyEnv: "OPENROUTER_API_KEY",
    translate: ({ key, model, system, text }) => chatCompletion("https://openrouter.ai/api/v1/chat/completions", key, model, system, text),
    check: (key) => request("https://openrouter.ai/api/v1/key", bearer(key)),
  },
};

const anthropicHeaders = (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" });
const bearer = (key) => ({ authorization: `Bearer ${key}` });

async function chatCompletion(url, key, model, system, text) {
  const body = await request(url, bearer(key), {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: text },
    ],
  });
  return body.choices?.[0]?.message?.content;
}

// GET when there is no payload, POST otherwise. Throws with the provider's error text.
async function request(url, headers, payload) {
  const res = await fetch(url, {
    method: payload ? "POST" : "GET",
    headers: { "content-type": "application/json", ...headers },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}: ${errorMessage(raw)}`);
  return JSON.parse(raw);
}

// All four providers put a readable message at error.message; fall back to the raw body.
function errorMessage(raw) {
  try {
    const { error } = JSON.parse(raw);
    if (typeof error?.message === "string") return error.message;
  } catch {}
  return raw.slice(0, 300);
}
