import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0b1220",
        surface: {
          50: "#26354a", 100: "#1f2b3d", 200: "#182334",
          300: "#131d2c", DEFAULT: "#172233",
        },
        border: {
          subtle: "rgba(187, 203, 226, 0.11)",
          active: "rgba(187, 203, 226, 0.25)",
          glow: "rgba(157, 181, 255, 0.28)",
        },
        brand: {
          cyan: "#9db5ff",
          emerald: "#52bc9b",
          amber: "#e9b761",
          rose: "#f18492",
          purple: "#ad9bf5",
          blue: "#8baafa",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        glow: "0 4px 24px -8px rgba(90, 120, 220, 0.18)",
        "glow-emerald": "0 4px 18px -8px rgba(82, 188, 155, .2)",
        "glow-rose": "0 4px 18px -8px rgba(241, 132, 146, .2)",
      },
    },
  },
  plugins: [],
};
export default config;
