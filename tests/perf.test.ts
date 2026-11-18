import { spawnSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { scan } from "../src/scan";
import { writeCorpus } from "./corpus";
import { CLI, ensureBuilt } from "./dist-build";
import { tmpDir } from "./helpers";

describe("performance", () => {
  const dir = tmpDir("slopscan-perf-");
  beforeAll(() => {
    writeCorpus(dir);
    ensureBuilt();
  });

  it("scans 300 files in under a second in process", () => {
    scan({ paths: [dir] });
    const started = performance.now();
    const result = scan({ paths: [dir] });
    const elapsed = performance.now() - started;
    expect(result.stats.filesScanned).toBe(300);
    expect(result.score.score).toBeGreaterThan(35);
    expect(elapsed).toBeLessThan(1000);
  });

  it("runs the built CLI on 300 files in under two seconds", () => {
    const started = performance.now();
    const child = spawnSync(process.execPath, [CLI, dir, "--quiet"], { encoding: "utf8" });
    const elapsed = performance.now() - started;
    expect(child.status).toBe(0);
    expect(child.stdout).toMatch(/^\d+\/100 /);
    expect(elapsed).toBeLessThan(2000);
  });
});
