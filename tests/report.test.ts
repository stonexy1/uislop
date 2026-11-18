import { describe, expect, it } from "vitest";
import { renderJson, renderQuiet, renderReport } from "../src/report";
import { createStyle } from "../src/ui/style";
import { sampleResult } from "./fixture-result";

const plain = createStyle(false);

describe("renderReport", () => {
  it("renders the no-color report", () => {
    const text = renderReport(sampleResult(), { style: plain, displayPath: "src", columns: 100, all: false, fixPrompt: "PROMPT", ci: null });
    expect(text.replace(/Done in \d+ ms/, "Done in X ms")).toMatchSnapshot();
  });

  it("truncates long messages to the width", () => {
    const text = renderReport(sampleResult(), { style: plain, displayPath: "src", columns: 80, all: false, fixPrompt: null, ci: null });
    for (const line of text.split("\n")) expect(line.length).toBeLessThanOrEqual(80);
    expect(text).toContain("…");
  });

  it("caps rows per file unless --all", () => {
    const result = sampleResult();
    const base = result.findings[0] as (typeof result.findings)[number];
    result.findings = Array.from({ length: 15 }, (_, i) => ({ ...base, line: i + 1 }));
    (result.score.files[0] as { findings: number }).findings = 15;
    const capped = renderReport(result, { style: plain, displayPath: ".", all: false, fixPrompt: null, ci: null });
    expect(capped).toContain("… 3 more in this file (run with --all)");
    const all = renderReport(result, { style: plain, displayPath: ".", all: true, fixPrompt: null, ci: null });
    expect(all).not.toContain("more in this file");
  });

  it("prints the CI footer", () => {
    const failed = renderReport(sampleResult(), {
      style: plain,
      displayPath: ".",
      all: false,
      fixPrompt: null,
      ci: { threshold: 20, passed: false, maxFileSlop: null, failingFile: null },
    });
    expect(failed).toContain("CI check failed: score 47 > max 20");
  });

  it("colors only when enabled", () => {
    const colored = renderReport(sampleResult(), { style: createStyle(true), displayPath: ".", all: false, fixPrompt: null, ci: null });
    expect(colored).toMatch(/\u001b\[/);
    expect(renderReport(sampleResult(), { style: plain, displayPath: ".", all: false, fixPrompt: null, ci: null })).not.toMatch(/\u001b\[/);
  });
});

describe("other renderers", () => {
  it("prints the quiet line", () => {
    expect(renderQuiet(sampleResult())).toBe("47/100 Template Vibe\n");
  });

  it("prints JSON with the documented shape", () => {
    const json = JSON.parse(renderJson(sampleResult(), { maxSlop: 20, passed: false }));
    expect(Object.keys(json)).toEqual(["schemaVersion", "tool", "root", "configPath", "durationMs", "score", "categories", "files", "findings", "warnings", "stats"]);
    expect(json.tool.name).toBe("@stonexy/slopscan");
    expect(json.score).toMatchObject({ value: 47, tier: "template-vibe", maxSlop: 20, passed: false });
    expect(json.files[0]).toHaveProperty("parse", "ok");
  });
});
