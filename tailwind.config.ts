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

          500: "#7c3aed",
          600: "#6d28d9",
          700: "#5b21b6",
        },
        accent: "#22d3ee",
      },
      fontFamily: {

      },
    },
  },
  plugins: [],
};

export default config;
