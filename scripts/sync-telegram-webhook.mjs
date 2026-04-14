/**
 * Calls POST /api/telegram/webhook-sync on localhost (Next must be running).
 * Reads TELEGRAM_WEBHOOK_SETUP_SECRET from .env or .env.local in project root.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const envLocal = parseEnvFile(path.join(root, ".env.local"));
const envFile = parseEnvFile(path.join(root, ".env"));
const secret = (
  envLocal.TELEGRAM_WEBHOOK_SETUP_SECRET ||
  envFile.TELEGRAM_WEBHOOK_SETUP_SECRET ||
  ""
).trim();

if (!secret) {
  console.error("Missing TELEGRAM_WEBHOOK_SETUP_SECRET in .env or .env.local");
  process.exit(1);
}

const port = process.env.PORT || "3000";
const url = `http://127.0.0.1:${port}/api/telegram/webhook-sync`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-telegram-setup-secret": secret,
  },
  body: "{}",
});

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

if (!res.ok) {
  console.error(res.status, body);
  process.exit(1);
}

console.log("OK:", body.webhookUrl || body);
