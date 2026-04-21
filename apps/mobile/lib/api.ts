import axios from "axios";
import { getApiBase } from "./env";

export const api = axios.create({ timeout: 600_000 });

api.interceptors.request.use((config) => {
  const base = getApiBase().replace(/\/+$/, "");
  config.baseURL = base;
  if (config.url && !config.url.startsWith("/")) {
    config.url = `/${config.url}`;
  }
  if (__DEV__) {
    const path = config.url ?? "";
    console.log(`[api] ${String(config.method ?? "GET").toUpperCase()} ${base}${path}`);
  }
  return config;
});
