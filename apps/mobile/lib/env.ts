import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Normalize origin: no trailing slashes, and no trailing `/api`
 * (axios paths already start with `/api/...`).
 */
export function normalizeApiBase(raw: string): string {
  let b = raw.trim().replace(/\/+$/, "");
  if (/\/api$/i.test(b)) {
    b = b.replace(/\/api$/i, "");
  }
  return b.replace(/\/+$/, "");
}

/**
 * Next.js origin only, e.g. http://10.0.2.2:3000
 * - Android emulator default: http://10.0.2.2:3000
 * - iOS simulator: http://localhost:3000
 * - Physical device: EXPO_PUBLIC_API_BASE or EXPO_PUBLIC_API_URL = http://<PC-LAN-IP>:3000
 */
export function getApiBase(): string {
  const fromProcess =
    process.env.EXPO_PUBLIC_API_BASE?.trim() ||
    process.env.EXPO_PUBLIC_API_URL?.trim() ||
    "";
  if (fromProcess) {
    return normalizeApiBase(fromProcess);
  }
  const extraRaw = (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase?.trim();
  if (extraRaw) {
    return normalizeApiBase(extraRaw);
  }
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }
  return "http://localhost:3000";
}
