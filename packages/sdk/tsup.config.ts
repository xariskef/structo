import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Zero runtime deps — no need to bundle anything external
  external: [],
  // Keep output lean and predictable
  splitting: false,
  treeshake: true,
  target: "es2020",
});
