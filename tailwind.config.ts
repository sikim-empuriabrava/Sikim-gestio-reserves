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
        background: "#11100e",
        surface: "#1b1814",
        primary: {
          50: "#fff8eb",
          100: "#f8ead0",
          200: "#eed2a3",
          300: "#dfb674",
          400: "#c99048",
          500: "#a96f2d",
          600: "#855224",
          700: "#643c1f",
          900: "#332016",
        },
        accent: "#9a7a46",
      },
      fontFamily: {

      },
    },
  },
  plugins: [],
};

export default config;
