import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "\"SF Pro Display\"",
          "\"SF Pro Text\"",
          "\"Segoe UI\"",
          "sans-serif"
        ]
      },
      boxShadow: {
        window: "0 34px 100px rgba(32, 45, 60, 0.24)",
        panel: "0 14px 44px rgba(30, 42, 54, 0.12)"
      },
      transitionTimingFunction: {
        mac: "cubic-bezier(0.25, 0.1, 0.25, 1)"
      }
    }
  },
  plugins: [forms]
};

export default config;
