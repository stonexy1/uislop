import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers";

export const CLI = join(ROOT, "dist", "cli.js");

export function ensureBuilt(): void {
  // Through the shell: on Windows npm is npm.cmd, which execFileSync cannot spawn directly.
  if (!existsSync(CLI)) execSync("npm run build", { cwd: ROOT, stdio: "ignore" });
}
