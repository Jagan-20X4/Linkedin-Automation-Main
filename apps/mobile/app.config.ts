import type { ExpoConfig } from "expo/config";

function normalizeApiBase(raw: string): string {
  let b = raw.trim().replace(/\/+$/, "");
  if (/\/api$/i.test(b)) {
    b = b.replace(/\/api$/i, "");
  }
  return b.replace(/\/+$/, "");
}

const envRaw = (
  process.env.EXPO_PUBLIC_API_BASE ??
  process.env.EXPO_PUBLIC_API_URL ??
  ""
).trim();
const apiBaseFromEnv = envRaw ? normalizeApiBase(envRaw) : undefined;

export default (): ExpoConfig => ({
  name: "LinkedIn Autopilot",
  slug: "linkedinautopilot",
  scheme: "linkedinautopilot",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  // Off for Expo Go + emulator stability; use EAS dev build + true when you need Fabric.
  newArchEnabled: false,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0f0f0f",
  },
  ios: { supportsTablet: true },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0f0f0f",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: "./assets/favicon.png" },
  plugins: [
    "expo-router",
    [
      "expo-image-picker",
      {
        photosPermission: "Allow LinkedIn Autopilot to attach images to posts.",
      },
    ],
  ],
  extra: {
    ...(apiBaseFromEnv ? { apiBase: apiBaseFromEnv } : {}),
    eas: {},
  },
});
