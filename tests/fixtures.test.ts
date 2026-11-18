import { describe, expect, it } from "vitest";
import { ALL_RULES, CATEGORIES } from "../src/rules/index";
import { scan } from "../src/scan";
import { fx } from "./helpers";

describe("fixtures", () => {
  const dirty = scan({ paths: [fx("dirty")] });
  const clean = scan({ paths: [fx("clean")] });

  it("dirty fixture triggers every rule and lands in Pure AI Slop", () => {
    const fired = new Set(dirty.findings.map((f) => f.ruleId));
    expect(ALL_RULES.map((r) => r.id).filter((id) => !fired.has(id))).toEqual([]);
    for (const category of CATEGORIES) expect(dirty.score.categories.find((c) => c.id === category)?.findings).toBeGreaterThan(0);
    expect(dirty.score.score).toBeGreaterThanOrEqual(61);
    expect(dirty.score.tier).toBe("pure-ai-slop");
    expect(dirty.stats.filesScanned).toBe(4);
    expect(dirty.warnings).toEqual([]);
  });

  it("clean fixture has zero findings", () => {
    expect(clean.findings).toEqual([]);
    expect(clean.score.score).toBe(0);
    expect(clean.score.tier).toBe("bespoke-craft");
    expect(clean.stats.filesScanned).toBe(4);
    expect(clean.warnings).toEqual([]);
  });
});
