// Target languages, keyed by country code. A country with several languages maps to its
// most common working language (in → Hindi). Add a row to support another country.

export const DEFAULT_LANGUAGE = "id";

export const LANGUAGES = {
  id: "Indonesian (Bahasa Indonesia)",
  in: "Hindi",
  my: "Malay (Bahasa Melayu)",
  sg: "English",
  ph: "Filipino",
  th: "Thai",
  vn: "Vietnamese",
  jp: "Japanese",
  kr: "Korean",
  cn: "Simplified Chinese",
  tw: "Traditional Chinese",
  sa: "Arabic",
  us: "English",
  gb: "British English",
  de: "German",
  fr: "French",
  es: "Spanish",
  br: "Brazilian Portuguese",
  nl: "Dutch",
};

// Returns { code, name }, or null for an unknown code.
export function resolveLanguage(code) {
  const normalized = code.trim().toLowerCase();
  return LANGUAGES[normalized] ? { code: normalized, name: LANGUAGES[normalized] } : null;
}
