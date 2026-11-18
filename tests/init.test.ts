import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bundledSkill, runInit } from "../src/commands/init";
import { tmpDir } from "./helpers";

const base = { cursor: false, agents: false, all: false, force: false };
const SKILL = ".claude/skills/uislop/SKILL.md";

describe("init", () => {
  it("creates the Claude Code skill", () => {
    const dir = tmpDir();
    const result = runInit({ ...base, dir });
    expect(result.exitCode).toBe(0);
    expect(result.lines).toEqual([`created   ${SKILL}`, 'Next: ask your agent to use the "uislop" skill, or run npx slopscan']);
    expect(readFileSync(join(dir, SKILL), "utf8")).toBe(bundledSkill());
  });

  it("reports unchanged files and never clobbers without --force", () => {
    const dir = tmpDir();
    runInit({ ...base, dir });
    expect(runInit({ ...base, dir }).lines[0]).toBe(`unchanged ${SKILL}`);
    writeFileSync(join(dir, SKILL), "custom");
    const skipped = runInit({ ...base, dir });
    expect(skipped.exitCode).toBe(1);
    expect(skipped.lines[0]).toBe(`skipped   ${SKILL} (differs from bundled version; use --force to overwrite)`);
    expect(readFileSync(join(dir, SKILL), "utf8")).toBe("custom");
    const forced = runInit({ ...base, dir, force: true });
    expect(forced.exitCode).toBe(0);
    expect(forced.lines[0]).toBe(`updated   ${SKILL}`);
  });

  it("writes Cursor and agents targets on request", () => {
    const dir = tmpDir();
    runInit({ ...base, dir, cursor: true });
    expect(existsSync(join(dir, ".cursor/skills/uislop/SKILL.md"))).toBe(true);
    expect(existsSync(join(dir, ".agents/skills/uislop/SKILL.md"))).toBe(false);
    const all = tmpDir();
    mkdirSync(join(all, "nested"));
    const result = runInit({ ...base, dir: join(all, "nested"), all: true });
    expect(result.lines.filter((l) => l.startsWith("created"))).toHaveLength(3);
  });
});
