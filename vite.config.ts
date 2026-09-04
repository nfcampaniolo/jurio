import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "spa-fallback-to-app-html",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = req.url?.split("?")[0] ?? "";

          // Esclude solo se termina con una reale estensione file (es. .js, .css, .png, .wasm)
          const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(url);
          const isInternalVite =
            url.startsWith("/@") ||
            url.startsWith("/src/") ||
            url.startsWith("/node_modules/");

          const isHtmlRequest = req.headers.accept?.includes("text/html");

          if (req.method === "GET" && isHtmlRequest && !hasFileExtension && !isInternalVite) {
            req.url = "/app.html";
          }

          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    headers: {
      // Necessari per @ffmpeg/ffmpeg e WebAssembly ad alte prestazioni
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "esnext", // Ottimale per React 19, Tesseract e top-level await
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, "app.html"),
      },
      // Esclude moduli server se accidentalmente referenziati nel codice client
      external: [
        "express",
        "firebase-admin",
        "firebase-functions",
        "@google-cloud/tasks",
        "@google-cloud/vision",
      ],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      reporter: ["lcov", "text"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx,js,jsx}"],
      exclude: ["src/test/**", "**/*.d.ts"],
    },
  },
});