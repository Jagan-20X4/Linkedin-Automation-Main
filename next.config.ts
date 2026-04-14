import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root },
  serverExternalPackages: ["node-telegram-bot-api", "@anthropic-ai/sdk"],
};

export default nextConfig;
