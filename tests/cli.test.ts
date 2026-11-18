import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeBadgeArgs, runCli } from "../src/run";
import { fx, tmpDir } from "./helpers";

async function cli(argv: string[], cwd = process.cwd()) {
  let stdout = "";
  let stderr = "";
  const code = await runCli(argv, {
    stdout: (t) => (stdout += t),
    stderr: (t) => (stderr += t),
    cwd,
    env: {},
    isTTY: false,
    columns: 100,
  });
  return { code, stdout, stderr };
}

describe("cli", () => {
  it("prints the report and exits 0 without --ci", async () => {
    const { code, stdout } = await cli([fx("dirty")]);
    expect(code).toBe(0);
    expect(stdout).toMatch(/Slop Score {2}\d+\/100 {2}Pure AI Slop/);
    expect(stdout).toContain("Fix prompt");
    expect(stdout).not.toMatch(/\u001b\[/);
  });

  it("applies --ci thresholds", async () => {
    expect((await cli([fx("dirty"), "--ci", "--max-slop", "20"])).code).toBe(1);
    expect((await cli([fx("clean"), "--ci", "--max-slop", "20"])).code).toBe(0);
    expect((await cli([fx("dirty"), "--max-slop", "100"])).code).toBe(0);
    expect((await cli([fx("dirty"), "--ci"])).stdout).toContain("CI check failed: score");
    const fileGate = await cli([fx("dirty"), "--max-slop", "100", "--max-file-slop", "40"]);
    expect(fileGate.code).toBe(1);
    expect(fileGate.stdout).toContain("worst file src/Landing.tsx");
  });

  it("prints JSON with all fields", async () => {
    const { stdout } = await cli([fx("dirty"), "--json", "--max-slop", "20"]);
    const json = JSON.parse(stdout);
    expect(json.schemaVersion).toBe(1);
    expect(json.score.passed).toBe(false);
    expect(json.findings.length).toBeGreaterThan(50);
    expect(json.findings[0]).toHaveProperty("fixHint");
  });

  it("prints only the prompt with --prompt", async () => {
    const { stdout } = await cli([fx("dirty"), "--prompt"]);
    expect(stdout.startsWith("You are fixing")).toBe(true);
    expect(stdout).not.toContain("Slop Score");
  });

  it("prints the quiet line", async () => {
    expect((await cli([fx("clean"), "-q"])).stdout).toBe("0/100 Bespoke Craft\n");
  });

  it("writes badges", async () => {
    const dir = tmpDir();
    const bare = await cli(["--badge", fx("clean")], dir);
    expect(bare.stdout).toContain("Badge written to uislop-badge.svg");
    expect(readFileSync(join(dir, "uislop-badge.svg"), "utf8")).toContain("0/100 · Bespoke Craft");
    await cli([fx("dirty"), "--badge", "out/b.svg", "--json"], dir);
    expect(existsSync(join(dir, "out", "b.svg"))).toBe(true);
    await cli([fx("dirty"), "--badge=c.svg", "-q"], dir);
    expect(existsSync(join(dir, "c.svg"))).toBe(true);
  });

  it("rewrites --badge arguments", () => {
    expect(normalizeBadgeArgs(["--badge", "x.SVG", "src"])).toEqual(["--badge-file=x.SVG", "src"]);
    expect(normalizeBadgeArgs(["--badge", "src"])).toEqual(["--badge", "src"]);
  });

  it("exits 2 on usage and config errors", async () => {
    expect((await cli(["--nope"])).code).toBe(2);
    expect((await cli(["does-not-exist"])).code).toBe(2);
    expect((await cli([fx("clean"), "--max-slop", "abc"])).code).toBe(2);
    const dir = tmpDir();
    writeFileSync(join(dir, "uislop.config.json"), "{ broken");
    const bad = await cli([dir]);
    expect(bad.code).toBe(2);
    expect(bad.stderr).toMatch(/^error: uislop\.config\.json: /);
  });

  it("uses config maxSlop and warns on unknown keys", async () => {
    const dir = tmpDir();
    writeFileSync(join(dir, "uislop.config.json"), '{"maxSlop": 0, "extra": true}');
    writeFileSync(join(dir, "a.tsx"), '<a href="#">x</a>');
    const run = await cli([dir, "--ci"]);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("warning: uislop.config.json: extra: unknown key, ignored");
  });

  it("reports an empty scan", async () => {
    const run = await cli([tmpDir()]);
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("No .tsx/.jsx/.css/.html files found in");
  });

  it("prints version and help", async () => {
    expect((await cli(["--version"])).stdout).toMatch(/^\d+\.\d+\.\d+\n$/);
    expect((await cli(["--help"])).stdout).toContain("npx slopscan <path> --ci --max-slop 15");
  });

  it("runs init", async () => {
    const dir = tmpDir();
    const run = await cli(["init", "--dir", dir]);
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("created   .claude/skills/uislop/SKILL.md");
  });
});
