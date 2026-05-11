import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Arcade cabinet shell — softer reference-matching tones
        "cabinet-blue": "#5fb8f5",
        "cabinet-blue-deep": "#3a8fd6",
        "cabinet-blue-shadow": "#1f4f9c",
        "cabinet-frame": "#1d2c4a",

        // Marquee top sign
        "marquee-yellow": "#ffe21d",
        "marquee-stripe": "#7be67d",

        // CRT screen
        "crt-cream": "#fff8e0",
        "crt-shadow": "#e6dbb0",

        // Green gradient palette (bubble)
        "bubble-green-light": "#d4ffb8",
        "bubble-green": "#7be67d",
        "bubble-green-deep": "#3fbb4a",

        // Accent buttons
        "btn-green": "#23c93a",
        "btn-red": "#ff3838",
        "btn-yellow": "#ffd84d",
        "btn-blue": "#1ea7ff",

        // Legacy Y2K tones
        "pink-y2k": "#ff3d8a",
        "yellow-y2k": "#ffd84d",
        "magenta-y2k": "#ff1a6b",
      },
      fontFamily: {
        // Heavy Korean+Latin sans for the marquee + hero headlines
        marquee: ["var(--font-marquee)", "system-ui", "sans-serif"],
        // Clean Korean+Latin sans for body, lists, captions
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        // `font-pixel` retained as a legacy alias to avoid touching every
        // component; it now points at the body font (matches reference's
        // clean look rather than the previous DotGothic16 pixel face).
        pixel: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "bubble-grad":
          "linear-gradient(180deg, #d4ffb8 0%, #ffffff 55%, #ffffff 100%)",
        "wordmark-grad":
          "linear-gradient(180deg, #3fbb4a 0%, #d4ffb8 55%, #ffffff 100%)",
        "scanlines":
          "repeating-linear-gradient(0deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent 3px)",
        // Cabinet body — silver/grey metallic gradient. Reads as "machine"
        // against the light-cyan locker wallpaper instead of blending in.
        "cabinet-body":
          "linear-gradient(180deg, #eaedf0 0%, #c5cad0 30%, #9ba0a8 65%, #6f747c 100%)",
        // Keyboard panel — slightly warmer grey, distinct from outer body
        "cabinet-panel":
          "linear-gradient(180deg, #d2d6dc 0%, #a8adb5 100%)",
      },
      boxShadow: {
        // Lighter offset drop-shadow + soft halo (reference-matching)
        "y2k": "2px 2px 0 rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.10)",
        "y2k-sm": "1px 1px 0 rgba(0, 0, 0, 0.12)",
        "cabinet": "0 6px 16px rgba(0, 0, 0, 0.18)",
        "soft": "0 2px 6px rgba(0, 0, 0, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
