// API keys live in the developer's profile (~/.config/act-sdlc/.env), so they survive plugin updates.
// Variables already set in the shell win over the file.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { profileDir } from "./config.mjs";

export const ENV_FILE = join(profileDir(), ".env");

export function loadEnv() {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
}
