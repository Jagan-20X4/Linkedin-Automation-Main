/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#0f0f0f",
        surface: "#1a1a1a",
        surface2: "#222222",
        accent: "#0a66c2",
        accentlight: "#1d8aff",
        success: "#1db954",
        muted: "#888888",
        border: "rgba(255,255,255,0.08)",
        primarytext: "#f0f0f0",
        secondarytext: "#aaaaaa",
      },
    },
  },
  plugins: [],
};
