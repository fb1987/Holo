import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4317,
    strictPort: true,
    watch: { ignored: ["**/release/**", "**/dist-server/**"] },
    proxy: { "/api": { target: "http://127.0.0.1:4318", changeOrigin: false } },
  },
  build: { outDir: "dist" },
  base: "./",
});
