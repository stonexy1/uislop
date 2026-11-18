import { describe, expect, it } from "vitest";
import { allocate, computeScore, pointsFor, scoreFindings, tierFor } from "../src/scorer";
import type { Category, Finding, Severity } from "../src/types";

function finding(category: Category, points: number, file = "a.tsx", severity: Severity = "warn"): Finding {
  return { ruleId: `${category}/x`, category, severity, message: "", file, line: 1, column: 1, snippet: "", fixHint: "", points };
}

describe("scorer", () => {
  it("matches the worked examples", () => {
    expect(computeScore(198.5, 159)).toBe(92);
    expect(computeScore(0, 159)).toBe(0);
    expect(computeScore(3, 3000)).toBe(0);
    expect(computeScore(4, 3000)).toBe(0);
    expect(computeScore(25.5, 20)).toBe(64);
    expect(computeScore(2, 12)).toBe(8);
    expect(computeScore(4, 12)).toBe(15);
  });

  it("multiplies weight by severity", () => {
    expect(pointsFor(3, "error")).toBe(4.5);
    expect(pointsFor(2, "warn")).toBe(2);
    expect(pointsFor(1, "info")).toBe(0.5);
  });

  it.each([
    [0, "bespoke-craft"],
    [15, "bespoke-craft"],
    [16, "minor-slop"],
    [35, "minor-slop"],
    [36, "template-vibe"],
    [60, "template-vibe"],
    [61, "pure-ai-slop"],
    [100, "pure-ai-slop"],
  ])("score %i is tier %s", (score, tier) => {
    expect(tierFor(score).id).toBe(tier);
  });

  it("allocates category points by largest remainder", () => {
    expect(allocate(92, [50.5, 45, 32, 31, 29, 11])).toEqual([23, 21, 15, 14, 14, 5]);
    expect(allocate(7, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(7);
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
  });

  it("never lowers the score when a finding is added", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const categories: Category[] = ["color-slop", "emoji-ui", "copy-slop", "layout-slop", "typo-slop", "fake-ui"];
    const list: Finding[] = [];
    let previous = 0;
    for (let i = 0; i < 200; i++) {
      list.push(finding(categories[Math.floor(random() * 6)] as Category, [0.5, 1, 1.5, 2, 3, 4.5][Math.floor(random() * 6)] as number));
      const result = scoreFindings(list, [{ path: "a.tsx", kind: "tsx", units: 120, parseMode: "ok" }]);
      expect(result.score).toBeGreaterThanOrEqual(previous);
      expect(result.categories.reduce((s, c) => s + c.points, 0)).toBe(result.score);
      previous = result.score;
    }
  });

  it("scores files separately and names the worst one", () => {
    const result = scoreFindings([finding("fake-ui", 3, "a.tsx"), finding("fake-ui", 30, "b.tsx")], [
      { path: "a.tsx", kind: "tsx", units: 100, parseMode: "ok" },
      { path: "b.tsx", kind: "tsx", units: 10, parseMode: "ok" },
    ]);
    expect(result.files.map((f) => [f.path, f.score])).toEqual([
      ["b.tsx", 70],
      ["a.tsx", 6],
    ]);
    expect(result.worstFile).toBe("b.tsx");
  });
});
