import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  entry: { cli: "src/cli.ts", index: "src/index.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  splitting: true,
  sourcemap: false,
  minify: false,
  dts: { entry: { index: "src/index.ts" } },
  define: { __VERSION__: JSON.stringify(pkg.version) },
});
