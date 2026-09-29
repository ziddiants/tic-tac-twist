/// <reference types="vitest" />
import { defineConfig } from "vite";

// Vite + Vitest config. Engine and solver are pure (node env) so they test without a DOM.
export default defineConfig({
  base: "./", // relative asset paths — deploys under any static host / subpath
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
