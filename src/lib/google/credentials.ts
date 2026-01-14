import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let didSetup = false;

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function normalizeJsonEnv(raw: string): string {
  const trimmed = raw.trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function ensureGoogleApplicationCredentials(): string | null {
  if (didSetup) return process.env.GOOGLE_APPLICATION_CREDENTIALS ?? null;
  didSetup = true;

  const existingPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (existingPath && fileExists(existingPath)) {
    return existingPath;
  }

  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!rawJson) return existingPath ?? null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizeJsonEnv(rawJson));
  } catch (err) {
    throw new Error(
      `GOOGLE_SERVICE_ACCOUNT_JSON must be valid JSON (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  const obj = parsed as { client_email?: unknown; private_key?: unknown };
  if (typeof obj?.client_email !== "string" || typeof obj?.private_key !== "string") {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing required fields (client_email/private_key).");
  }

  const targetPath = path.join(os.tmpdir(), "rtvox-google-credentials.json");
  try {
    fs.writeFileSync(targetPath, JSON.stringify(parsed), { encoding: "utf8", mode: 0o600 });
  } catch (err) {
    throw new Error(
      `Failed to write Google credentials to ${targetPath} (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = targetPath;
  return targetPath;
}

