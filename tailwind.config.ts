import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090d",
          900: "#0b0f16",
          850: "#10151e",
          800: "#161c28",
          700: "#1f2735",
          600: "#2b3647",
          500: "#3d4a5e",
        },
        accent: {
          cyan: "#22d3ee",
          lime: "#a3e635",
          amber: "#fbbf24",
          orange: "#fb923c",
          rose: "#fb7185",
          violet: "#a78bfa",
          blue: "#60a5fa",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
    },
  },
  plugins: [],
};

export default config;
