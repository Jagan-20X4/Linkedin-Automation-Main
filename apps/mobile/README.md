# LinkedIn Autopilot — Mobile (Expo)

React Native client for the same Next.js API as the website.

## API base URL

| Environment | URL |
|-------------|-----|
| Android emulator (default) | `http://10.0.2.2:3000` |
| iOS simulator (default) | `http://localhost:3000` |
| Physical phone | `http://<YOUR_PC_LAN_IP>:3000` |

Override anytime:

```bash
set EXPO_PUBLIC_API_BASE=http://192.168.1.50:3000
npx expo start
```

(PowerShell: `$env:EXPO_PUBLIC_API_BASE="http://..."`)

## Run the Next.js backend (reachable from emulator)

From the **repo root**:

```bash
npm run dev
```

This binds to **0.0.0.0:3000** so the Android emulator can reach it via `10.0.2.2`.

## Install & run the mobile app

```bash
cd apps/mobile
npm install
npx expo install expo-clipboard expo-image-picker
npm run android
```

Or: `npx expo start` → press **`a`** to open the Android emulator.

**Requirements:** Android Studio + AVD (virtual device) installed, or a USB device with USB debugging.

## Cleartext HTTP (Android)

The dev server uses **HTTP**. If Android blocks requests, use `EXPO_PUBLIC_API_BASE` pointing to an **HTTPS** tunnel (e.g. ngrok) or add a build-properties plugin for `usesCleartextTraffic` in a dev client.

## Features mirrored from the web app

- **Dashboard** — chat count, due/published approval counts  
- **Compose** — `POST /api/generate-post`, optional image, `POST /api/linkedin/post`  
- **Compose V2** — chat list, swipe/long-press delete, chat detail, weeks/months, `POST /api/v2/generate`, post images add/remove, copy, `POST /api/v2/publish-linkedin`  
- **Approvals** — filters, expand, edit/save content, images, approve/reject when **Due now** (same as web)  
- **Comments** — published posts, LinkedIn comments, suggest reply, post reply  

Not included: ORM monitor, Settings env editor, web-only queue UI (if any).
