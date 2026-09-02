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

          // Intercetta solo le richieste di navigazione delle pagine (SPA routing)
          // Ignora file statici con estensioni (.js, .css, .svg), assets e percorsi interni di Vite
          const isAssetOrInternal =
            url.includes(".") ||
            url.startsWith("/@") ||
            url.startsWith("/src/") ||
            url.startsWith("/node_modules/");

          const isHtmlRequest = req.headers.accept?.includes("text/html");

          if (req.method === "GET" && isHtmlRequest && !isAssetOrInternal) {
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
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, "app.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      reporter: ["lcov", "text"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx,js,jsx}"],
      exclude: [
        "src/**/__tests__/**",
        "src/test/**",
        "**/*.d.ts",
      ],
    },
  },
});