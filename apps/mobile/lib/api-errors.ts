import axios from "axios";

/** User-visible message for failed API calls (includes URL on 404 for debugging). */
export function formatApiError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status;
    const base = e.config?.baseURL ?? "";
    const path = e.config?.url ?? "";
    const full = `${base}${path}`;
    const serverMsg =
      typeof e.response?.data === "object" &&
      e.response?.data !== null &&
      "error" in e.response.data
        ? String((e.response.data as { error?: unknown }).error ?? "")
        : "";
    if (status === 404) {
      return [
        "Not found (404).",
        full ? `URL: ${full}` : "",
        serverMsg ? `Server: ${serverMsg}` : "",
        "If the URL contains /api/api/, remove /api from EXPO_PUBLIC_API_BASE.",
      ]
        .filter(Boolean)
        .join("\n");
    }
    return [serverMsg || e.message, full ? `(${full})` : ""].filter(Boolean).join(" ");
  }
  return e instanceof Error ? e.message : "Request failed";
}
