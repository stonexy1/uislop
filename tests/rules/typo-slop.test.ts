import { describe, expect, it } from "vitest";
import { isNumericText } from "../../src/rules/typo-slop";
import { runRule } from "../helpers";

const NUMS = "typo-slop/missing-tabular-nums";
const PARA = "typo-slop/unconstrained-paragraph";
const long = "A".repeat(170);

describe("typo-slop/missing-tabular-nums", () => {
  it.each([
    ["$1,299", true],
    ["98.2%", true],
    ["10k+", true],
    ["120ms", true],
    ["42", true],
    ["1", false],
    ["Step 2", false],
  ])("isNumericText(%s) = %s", (text, expected) => {
    expect(isNumericText(text)).toBe(expected);
  });

  it("flags numeric cells and stats", () => {
    expect(runRule(NUMS, "<table><tbody><tr><td>$1,299</td></tr></tbody></table>")[0]?.message).toBe('Number "$1,299" without tabular-nums');
  });

  it("respects tabular-nums or font-mono on the element or an ancestor", () => {
    expect(runRule(NUMS, '<table className="tabular-nums"><tbody><tr><td>$1,299</td></tr></tbody></table>')).toHaveLength(0);
    expect(runRule(NUMS, '<span className="font-mono">1,204</span>')).toHaveLength(0);
    expect(runRule(NUMS, '<span style="font-variant-numeric: tabular-nums">1,204</span>', "html")).toHaveLength(0);
  });

  it("flags dynamic numbers in cells as info", () => {
    expect(runRule(NUMS, "<td>{total.toFixed(2)}</td>")[0]?.severity).toBe("info");
    expect(runRule(NUMS, "<td>{name}</td>")).toHaveLength(0);
  });
});

describe("typo-slop/unconstrained-paragraph", () => {
  const tw = (inner: string) => `<div className="flex gap-4 p-4">${inner}</div>`;
  it("flags a long paragraph without a width cap", () => {
    expect(runRule(PARA, tw(`<p className="mt-2">${long}</p>`))[0]?.message).toBe("Long paragraph (170 chars) with no width constraint");
  });

  it("accepts max-w on an ancestor, prose, or a narrow width", () => {
    expect(runRule(PARA, `<div className="max-w-2xl p-4 mx-auto">${tw(`<p>${long}</p>`)}</div>`)).toHaveLength(0);
    expect(runRule(PARA, tw(`<p className="prose">${long}</p>`))).toHaveLength(0);
    expect(runRule(PARA, tw(`<p className="max-w-[60ch]">${long}</p>`))).toHaveLength(0);
  });

  it("does not evaluate files without Tailwind classes", () => {
    expect(runRule(PARA, `<p className="intro">${long}</p>`)).toHaveLength(0);
  });
});
