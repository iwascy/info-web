import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ops: {
          bg: "#050C1A",
          panel: "#0B1930",
          blue: "#3785FF",
          cyan: "#17D5EB",
          green: "#29D684",
          yellow: "#F8B831",
          red: "#FF5B6F",
          purple: "#975CFF"
        }
      }
    }
  },
  plugins: []
};

export default config;
