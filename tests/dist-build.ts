import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers";

export const CLI = join(ROOT, "dist", "cli.js");

export function ensureBuilt(): void {
  if (!existsSync(CLI)) execFileSync("npm", ["run", "build"], { cwd: ROOT, stdio: "ignore" });
}
