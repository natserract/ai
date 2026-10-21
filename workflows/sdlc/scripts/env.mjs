// The plugin's .env lives at the plugin root (workflows/sdlc/.env).
// Variables already set in the shell win over the file.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ENV_FILE = join(dirname(dirname(fileURLToPath(import.meta.url))), ".env");

export function loadEnv() {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
}
