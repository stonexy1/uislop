import { describe, expect, it } from "vitest";
import { extractColors, inAiRange, inPartnerRange, parseColor, parseShadowList, toHsl } from "../../src/parse/color";

describe("color", () => {
  it.each([
    ["#000", { r: 0, g: 0, b: 0, a: 1 }],
    ["#6366f1", { r: 99, g: 102, b: 241, a: 1 }],
    ["#00000080", { r: 0, g: 0, b: 0, a: 128 / 255 }],
    ["rgb(0, 0, 0)", { r: 0, g: 0, b: 0, a: 1 }],
    ["rgb(139 92 246 / 0.5)", { r: 139, g: 92, b: 246, a: 0.5 }],
    ["rgba(255,255,255,.25)", { r: 255, g: 255, b: 255, a: 0.25 }],
    ["black", { r: 0, g: 0, b: 0, a: 1 }],
  ])("parses %s", (input, expected) => {
    expect(parseColor(input)).toEqual(expected);
  });

  it("parses hsl", () => {
    const c = parseColor("hsl(258 90% 66%)");
    expect(c && Math.round(toHsl(c).h)).toBe(258);
  });

  it("rejects non-colors", () => {
    expect(parseColor("var(--x)")).toBeNull();
    expect(parseColor("url(a.png)")).toBeNull();
  });

  it("classifies hue ranges", () => {
    expect(inAiRange(parseColor("#8b5cf6")!)).toBe(true);
    expect(inAiRange(parseColor("#10b981")!)).toBe(false);
    expect(inPartnerRange(parseColor("#3b82f6")!)).toBe(true);
    expect(inAiRange(parseColor("#71717a")!)).toBe(false);
  });

  it("parses shadow lists", () => {
    const [a, b] = parseShadowList("0 0 30px rgba(139,92,246,.5), inset 0 1px 2px #0000000f");
    expect(a).toMatchObject({ x: 0, y: 0, blur: 30 });
    expect(a?.color?.a).toBe(0.5);
    expect(b).toMatchObject({ x: 0, y: 1, blur: 2 });
  });

  it("extracts gradient stop colors and skips var()", () => {
    expect(extractColors("linear-gradient(90deg, #8b5cf6, var(--x), transparent, rgb(236 72 153))").map((c) => c.text)).toEqual([
      "#8b5cf6",
      "rgb(236 72 153)",
    ]);
  });
});
