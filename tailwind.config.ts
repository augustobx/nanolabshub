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
        background: "#080b11",
        surface: {
          50: "#182030",
          100: "#141a27",
          200: "#0f1521",
          300: "#0c101a",
          DEFAULT: "#0d131f",
        },
        border: {
          subtle: "rgba(255, 255, 255, 0.06)",
          active: "rgba(255, 255, 255, 0.14)",
          glow: "rgba(56, 189, 248, 0.3)",
        },
        brand: {
          cyan: "#00e5ff",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e",
          purple: "#a855f7",
          blue: "#3b82f6",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px -5px rgba(0, 229, 255, 0.25)",
        "glow-emerald": "0 0 20px -5px rgba(16, 185, 129, 0.3)",
        "glow-rose": "0 0 20px -5px rgba(244, 63, 94, 0.3)",
      },
      animation: {
        "pulse-fast": "pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scan-line": "scanline 8s linear infinite",
      },
      keyframes: {
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
