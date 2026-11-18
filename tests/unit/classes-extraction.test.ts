import { describe, expect, it } from "vitest";
import { parsed } from "../helpers";

const raws = (source: string) => parsed(source).classTokens.map((t) => t.raw);

describe("class extraction", () => {
  it("reads cn() strings, conditionals, object keys and arrays", () => {
    expect(raws('<div className={cn("a-1 b-2", cond && "c-3", { "d-4": x }, ["e-5"])} />')).toEqual([
      "a-1",
      "b-2",
      "c-3",
      "d-4",
      "e-5",
    ]);
  });

  it("reads nested clsx and both branches of a conditional", () => {
    expect(raws('<div className={clsx(open ? "bg-zinc-50" : "bg-white", clsx("p-4"))} />')).toEqual(["bg-zinc-50", "bg-white", "p-4"]);
  });

  it("reads cva base, variants and compoundVariants but not defaultVariants", () => {
    const source = `const button = cva("inline-flex px-4", {
      variants: { intent: { primary: "bg-emerald-600", ghost: "bg-transparent" } },
      compoundVariants: [{ intent: "primary", class: "shadow-sm" }],
      defaultVariants: { intent: "primary" },
    });`;
    expect(raws(source)).toEqual(["inline-flex", "px-4", "bg-emerald-600", "bg-transparent", "shadow-sm"]);
  });

  it("reads tw tagged templates", () => {
    expect(raws("const card = tw`rounded-lg border p-4`;")).toEqual(["rounded-lg", "border", "p-4"]);
  });

  it("detects class strings in plain objects with the heuristic", () => {
    const file = parsed('const v = { p: "bg-indigo-600 text-white" };');
    expect(file.classTokens.map((t) => [t.raw, t.origin])).toEqual([
      ["bg-indigo-600", "heuristic"],
      ["text-white", "heuristic"],
    ]);
  });

  it("does not treat prose as classes", () => {
    expect(raws('const s = "Fixed relative positioning";')).toEqual([]);
  });

  it("reports exact positions inside multi-line strings", () => {
    const file = parsed('<div\n  className="p-4\n    bg-zinc-50"\n/>');
    const token = file.classTokens.find((t) => t.raw === "bg-zinc-50");
    expect(token).toMatchObject({ line: 3, column: 5 });
  });

  it("ties attribute tokens to their element", () => {
    const file = parsed('<section className="p-4"><div className="m-2" /></section>');
    expect(file.classTokens.map((t) => t.owner?.tag)).toEqual(["section", "div"]);
  });
});
