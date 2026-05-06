import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f172a",
        surface: "#111827",
        primary: {
          50: "#fff8eb",
          100: "#f8e7c8",
          200: "#f1c98f",
          300: "#e0a454",
          400: "#d08a39",
          500: "#b86d25",
          600: "#96531b",
          700: "#743d17",
          900: "#3a2413",
        },
        accent: "#d08a39",
      },
      fontFamily: {

      },
    },
  },
  plugins: [],
};

export default config;
