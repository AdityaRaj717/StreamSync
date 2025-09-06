import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), mkcert(), tailwindcss()],
  server: {
    https: true,
    host: true,
  },
  // Add this resolve section
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
