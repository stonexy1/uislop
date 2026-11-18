import { describe, expect, it } from "vitest";
import { runRule } from "../helpers";

const GRADIENT = "color-slop/ai-gradient";
const div = (cls: string) => `<div className="${cls}" />`;

describe("color-slop/ai-gradient", () => {
  it("flags two AI stops as error and AI plus partner as warn", () => {
    expect(runRule(GRADIENT, div("bg-gradient-to-r from-indigo-500 to-purple-500"))[0]?.severity).toBe("error");
    expect(runRule(GRADIENT, div("bg-gradient-to-r from-blue-500 to-purple-600"))[0]?.severity).toBe("warn");
  });

  it("names gradient text", () => {
    expect(runRule(GRADIENT, div("bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent"))[0]?.message).toBe(
      "Gradient text (from-violet-600 to-indigo-600) is the default AI headline",
    );
  });

  it("supports v4 syntax, variants and arbitrary hex stops", () => {
    expect(runRule(GRADIENT, div("bg-linear-to-r from-indigo-500 hover:to-purple-600"))).toHaveLength(1);
    expect(runRule(GRADIENT, div("from-[#6366f1] to-[#a855f7]"))).toHaveLength(1);
  });

  it("ignores neutral gradients, a single AI stop and transparent stops", () => {
    expect(runRule(GRADIENT, div("bg-gradient-to-r from-zinc-100 to-zinc-300"))).toHaveLength(0);
    expect(runRule(GRADIENT, div("bg-gradient-to-r from-purple-500 to-transparent"))).toHaveLength(0);
    expect(runRule(GRADIENT, div("from-indigo-500"))).toHaveLength(0);
  });

  it("flags CSS gradients", () => {
    expect(runRule(GRADIENT, ".a { background: linear-gradient(90deg, #8b5cf6, #ec4899); }", "css")[0]?.message).toBe(
      "Gradient #8b5cf6 #ec4899 is the default AI palette",
    );
    expect(runRule(GRADIENT, ".a { background: linear-gradient(#fafafa, #e4e4e7); }", "css")).toHaveLength(0);
  });
});

describe("color-slop/neon-shadow", () => {
  const rule = "color-slop/neon-shadow";
  it("flags AI-hue shadows and strong glows", () => {
    expect(runRule(rule, div("shadow-lg shadow-purple-500/50"))).toHaveLength(1);
    expect(runRule(rule, div("hover:shadow-cyan-400/60"))).toHaveLength(1);
    expect(runRule(rule, div("shadow-[0_0_20px_rgba(34,211,238,0.6)]"))).toHaveLength(1);
    expect(runRule(rule, ".g { box-shadow: 0 0 30px rgba(139, 92, 246, 0.5); }", "css")).toHaveLength(1);
  });

  it("ignores neutral and faint shadows", () => {
    expect(runRule(rule, div("shadow-sm shadow-zinc-900/10"))).toHaveLength(0);
    expect(runRule(rule, div("shadow-blue-500/20"))).toHaveLength(0);
    expect(runRule(rule, ".g { box-shadow: 0 1px 2px rgb(0 0 0 / .06); }", "css")).toHaveLength(0);
  });
});

describe("color-slop/pure-black-white", () => {
  const rule = "color-slop/pure-black-white";
  it("flags pure black and the stark pairing once per element", () => {
    expect(runRule(rule, div("text-black"))[0]?.message).toBe("Pure black (text-black) instead of a nuanced neutral");
    const stark = runRule(rule, div("bg-black text-white border-black"));
    expect(stark).toHaveLength(1);
    expect(stark[0]?.message).toBe("Stark pure black/white pairing (bg-black)");
    expect(runRule(rule, div("bg-[#000]"))).toHaveLength(1);
  });

  it("ignores dark variants, opacity, white alone and overlay scrims", () => {
    expect(runRule(rule, div("dark:bg-black"))).toHaveLength(0);
    expect(runRule(rule, div("bg-black/50"))).toHaveLength(0);
    expect(runRule(rule, div("bg-white"))).toHaveLength(0);
    expect(runRule(rule, div("fixed inset-0 bg-black"))).toHaveLength(0);
  });

  it("checks CSS blocks except dark scopes and shadows", () => {
    expect(runRule(rule, ".a { color: #000; }", "css")).toHaveLength(1);
    expect(runRule(rule, ".dark .a { color: #000; }", "css")).toHaveLength(0);
    expect(runRule(rule, "@media (prefers-color-scheme: dark) { .a { background: black; } }", "css")).toHaveLength(0);
    expect(runRule(rule, ".a { box-shadow: 0 1px 2px #000; }", "css")).toHaveLength(0);
  });
});

describe("color-slop/ai-accent-palette", () => {
  const rule = "color-slop/ai-accent-palette";
  it("fires once when five or more AI accent classes appear", () => {
    const five = `<div>${'<a className="text-indigo-600" />'.repeat(5)}</div>`;
    const found = runRule(rule, five);
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toBe("Leans on the indigo accent family (5 uses): the default AI-template palette");
    expect(runRule(rule, `<div>${'<a className="text-indigo-600" />'.repeat(4)}</div>`)).toHaveLength(0);
  });
});
