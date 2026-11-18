import { createRequire } from "node:module";

declare const __VERSION__: string | undefined;

export const BRAND = "uislop";
export const PKG_NAME = "@stonexy/slopscan";
export const BIN_NAME = "slopscan";
export const BIN_ALIAS = "uislop";
export const NPX = `npx ${PKG_NAME}`;
export const CONFIG_FILE = "uislop.config.json";
export const IGNORE_KEYWORD = "uislop-ignore";
export const SKILL_NAME = "uislop";
export const TARGET_SLOP = 15;
export const DEFAULT_MAX_SLOP = 35;

function readPackageVersion(): string {
  const pkg = createRequire(import.meta.url)("../package.json") as { version: string };
  return pkg.version;
}

export const VERSION: string = typeof __VERSION__ === "string" ? __VERSION__ : readPackageVersion();
