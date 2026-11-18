import { describe, expect, it } from "vitest";
import { buildPrompt, selectFindings } from "../src/prompt-builder";
import { sampleResult } from "./fixture-result";

describe("buildPrompt", () => {
  it("renders the full template", () => {
    expect(buildPrompt(sampleResult(), { path: "src", maxFindings: 6 })).toMatchSnapshot();
  });

  it("contains no ANSI codes and uses the npx command", () => {
    const prompt = buildPrompt(sampleResult(), { path: "src" });
    expect(prompt).not.toMatch(/\u001b\[/);
    expect(prompt).toContain("Run `npx slopscan src --ci --max-slop 15`");
    expect(prompt.startsWith("You are fixing")).toBe(true);
  });

  it("reports overflow with file counts", () => {
    const prompt = buildPrompt(sampleResult(), { path: ".", maxFindings: 5 });
    expect(prompt).toContain("FINDINGS (5 of 7, highest impact first)");
    expect(prompt).toContain("…and 2 more findings in 2 files.");
  });

  it("includes design direction only for triggered categories", () => {
    const prompt = buildPrompt(sampleResult(), { path: "." });
    expect(prompt).toContain("- Palette:");
    expect(prompt).not.toContain("- Icons:");
  });

  it("caps findings per file and by character budget", () => {
    const result = sampleResult();
    const many = Array.from({ length: 20 }, (_, i) => ({ ...(result.findings[0] as (typeof result.findings)[number]), line: i + 1 }));
    expect(selectFindings(many, 30, 6000)).toHaveLength(8);
    expect(selectFindings(many, 30, 300).length).toBeLessThan(3);
  });
});
