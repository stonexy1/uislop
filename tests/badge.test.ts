import { describe, expect, it } from "vitest";
import { renderBadge } from "../src/badge";
import { textWidth } from "../src/badge-widths";

const width = (svg: string) => Number(/<svg[^>]* width="(\d+)"/.exec(svg)?.[1]);

describe("renderBadge", () => {
  it.each([
    [8, "Bespoke Craft", 51 + 133, "#4c1"],
    [92, "Pure AI Slop", 51 + 131, "#e05d44"],
    [41, "Template Vibe", 51 + 141, "#fe7d37"],
    [20, "Minor Slop", 51 + 121, "#dfb317"],
  ])("renders %i/100 %s", (score, tier, total, color) => {
    const svg = renderBadge(score, tier);
    expect(width(svg)).toBe(total);
    expect(svg).toContain(`fill="${color}"`);
    expect(svg).toContain(`aria-label="UI Slop: ${score}/100 · ${tier}"`);
  });

  it("measures the label at 51px", () => {
    expect(Math.ceil(textWidth("UI Slop") + 10)).toBe(51);
  });

  it("escapes text", () => {
    expect(renderBadge(5, 'A&B<"x">')).toContain("A&amp;B&lt;&quot;x&quot;&gt;");
  });

  it("matches the snapshot", () => {
    expect(renderBadge(8, "Bespoke Craft")).toMatchSnapshot();
  });
});
