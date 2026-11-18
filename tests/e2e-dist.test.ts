import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { CLI, ensureBuilt } from "./dist-build";
import { fx } from "./helpers";

const run = (...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });

describe("built CLI", () => {
  beforeAll(ensureBuilt);

  it("keeps the shebang", () => {
    expect(readFileSync(CLI, "utf8").split("\n")[0]).toBe("#!/usr/bin/env node");
  });

  // Windows has no executable bit; npm creates command shims there instead.
  it.skipIf(process.platform === "win32")("sets the executable bit", () => {
    expect(statSync(CLI).mode & 0o111).not.toBe(0);
  });

  it("fails CI on the dirty fixture and passes on the clean one", () => {
    const dirty = run(fx("dirty"), "--ci", "--max-slop", "20");
    expect(dirty.status).toBe(1);
    expect(dirty.stdout).toContain("Pure AI Slop");
    const clean = run(fx("clean"), "--ci", "--max-slop", "20");
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain("No findings.");
  });

  it("prints the version", () => {
    expect(run("--version").stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
