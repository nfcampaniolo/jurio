import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Test dell'add-in Word (cartella tests/).
 * - `npm test`             → suite unitaria/componenti (deve essere sempre verde)
 * - `npm run test:release` → controlli di prontezza al rilascio (manifest, URL di produzione, segreti nel bundle)
 */
const isRelease = process.env.TEST_SUITE === "release";

export default defineConfig({
  // Le costanti iniettate da webpack.DefinePlugin devono esistere anche nei test
  define: {
    __FIREBASE_CONFIG__: JSON.stringify({ apiKey: "test", authDomain: "auth.test", projectId: "jurio-test", appId: "app" }),
    __WORD_AGENT_URL__: JSON.stringify("https://wordagent.test"),
    __WORD_AUTH_URL__: JSON.stringify("https://wordauth.test"),
    __WEB_APP_URL__: JSON.stringify("https://app.jurio.test"),
    __RECAPTCHA_SITE_KEY__: JSON.stringify("test-site-key"),
    __APPCHECK_DEBUG_TOKEN__: JSON.stringify(""),
  },
  esbuild: {
    jsx: "transform",
  },
  resolve: {
    alias: {
      "@word": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: isRelease ? ["tests/release/**/*.test.ts"] : ["tests/**/*.test.{ts,tsx}"],
    exclude: isRelease ? [] : ["tests/release/**", "node_modules/**"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/commands/**"],
    },
  },
});
