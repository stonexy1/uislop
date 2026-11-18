import { describe, expect, it } from "vitest";
import { parsed } from "../helpers";

describe("css parser", () => {
  it("records declarations with selector, at-rule and line", () => {
    const file = parsed("/* c */\n.a { color: red; }\n@media (prefers-color-scheme: dark) {\n  .b { color: #000 }\n}", "css");
    expect(file.decls.map((d) => [d.prop, d.value, d.selector, d.atRule, d.line])).toEqual([
      ["color", "red", ".a", null, 2],
      ["color", "#000", ".b", "@media (prefers-color-scheme: dark)", 4],
    ]);
    expect(file.units).toBe(2);
  });

  it("ignores declarations inside comments and keeps strings", () => {
    const file = parsed('.a { /* color: black; */ content: "a;b{c}"; }', "css");
    expect(file.decls.map((d) => [d.prop, d.value])).toEqual([["content", '"a;b{c}"']]);
  });

  it("tokenizes @apply and skips @font-face", () => {
    const file = parsed("@font-face { font-family: X; }\n.b { @apply p-4 bg-zinc-50; }", "css");
    expect(file.classTokens.map((t) => [t.raw, t.origin, t.line])).toEqual([
      ["p-4", "apply", 2],
      ["bg-zinc-50", "apply", 2],
    ]);
    expect(file.decls).toHaveLength(0);
  });

  it("does not split on semicolons inside url()", () => {
    const file = parsed(".a { background: url(data:image/png;base64,AAA); color: blue }", "css");
    expect(file.decls.map((d) => d.prop)).toEqual(["background", "color"]);
  });
});
