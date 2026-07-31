import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimal config: just the "@/*" -> "src/*" alias tsconfig.json already
// defines, so tests can import the same way app code does. No React/DOM
// test environment configured -- these are unit tests for plain server-side
// logic (date math, string escaping), not components.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
