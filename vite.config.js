import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths are required for Capacitor's local Android WebView.
  base: "./",
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true
      }
    }
  }
});
