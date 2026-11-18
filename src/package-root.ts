import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PKG_NAME } from "./meta";

export function findPackageRoot(from: string = fileURLToPath(import.meta.url)): string {
  let dir = dirname(from);
  for (;;) {
    const candidate = join(dir, "package.json");
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, "utf8")) as { name?: string };
      if (pkg.name === PKG_NAME) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`Cannot locate the ${PKG_NAME} package root from ${from}`);
    dir = parent;
  }
}
