const NGROK_LOCAL_API = "http://127.0.0.1:4040/api/tunnels";

type NgrokTunnel = { proto?: string; public_url?: string };

type NgrokTunnelsResponse = { tunnels?: NgrokTunnel[] };

/**
 * Reads the active HTTPS public URL from ngrok's local agent API (same machine).
 * Returns null if ngrok is not running or no https tunnel exists.
 */
export async function getNgrokHttpsPublicUrl(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(NGROK_LOCAL_API, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = (await res.json()) as NgrokTunnelsResponse;
    const https = data.tunnels?.find((x) => x.proto === "https" && x.public_url);
    const raw = https?.public_url?.trim();
    if (!raw) return null;
    return raw.replace(/\/$/, "");
  } catch {
    return null;
  }
}
