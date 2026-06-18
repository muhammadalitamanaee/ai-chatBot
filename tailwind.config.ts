import type { Config } from "tailwindcss";

export default {
  // 'class' means dark mode is toggled by adding .dark to <html>
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {} },
  plugins: [
    require("@tailwindcss/typography"), // for prose classes in MessageBubble
  ],
} satisfies Config;
