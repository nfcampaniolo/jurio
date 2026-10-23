import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Il lint root copre l'app web. Functions hanno un progetto separato e una build TypeScript dedicata in CI;
  // Word è un add-in separato e non fa parte del package web.
  globalIgnores(['dist/**', 'coverage/**', 'functions/**', 'word/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
     rules: {
      "react-hooks/incompatible-library": "off",
    }
  },
])
