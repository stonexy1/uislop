import { describe, expect, it } from "vitest";
import { parsed } from "../helpers";

describe("tsx parser", () => {
  it("builds the element tree with attributes and texts", () => {
    const file = parsed('<main><h1 title="Hi">Hello <b>world</b></h1></main>');
    expect(file.allElements.map((e) => e.tag)).toEqual(["main", "h1", "b"]);
    const h1 = file.allElements[1];
    expect(h1?.parent?.tag).toBe("main");
    expect(h1?.attrs.get("title")?.value).toBe("Hi");
    expect(file.texts.map((t) => [t.text, t.origin])).toEqual([
      ["Hi", "attr"],
      ["Hello", "jsx-text"],
      ["world", "jsx-text"],
    ]);
  });

  it("classifies handlers", () => {
    const file = parsed(
      '<div><button onClick={() => {}} /><button onClick={() => console.log(1)} /><button onClick={() => save(id)} /><form onSubmit={(e) => e.preventDefault()} /><b onClick={noop} /></div>',
    );
    const kinds = file.allElements.slice(1).map((e) => [...e.attrs.values()][0]?.handler);
    expect(kinds).toEqual(["empty", "console", "other", "preventdefault-only", "noop-ident"]);
  });

  it("turns .map over a const array into a repeated virtual child", () => {
    const file = parsed("const items = [1, 2, 3, 4];\nexport const L = () => <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>;");
    const li = file.allElements.find((e) => e.tag === "li");
    expect(li?.repeated).toEqual({ source: "map", count: 4 });
    expect(li?.parent?.tag).toBe("ul");
  });

  it("leaves the count unknown for data-driven lists", () => {
    const file = parsed("export const L = ({ rows }) => <ul>{rows.map((r) => <li>{r}</li>)}</ul>;");
    expect(file.allElements.find((e) => e.tag === "li")?.repeated).toEqual({ source: "map", count: null });
  });

  it("skips JSX comments as text", () => {
    const file = parsed("<div>{/* note */}Text</div>");
    expect(file.texts.map((t) => t.text)).toEqual(["Text"]);
    expect(file.allElements[0]?.hasDynamicChild).toBe(false);
  });

  it("collects static strings from object properties", () => {
    const file = parsed('const f = [{ title: "Fast builds", icon: "🔥" }];');
    expect(file.texts.map((t) => [t.text, t.origin, t.attrName])).toEqual([
      ["Fast builds", "prop", "title"],
      ["🔥", "prop", "icon"],
    ]);
  });

  it("reads style objects as declarations", () => {
    const file = parsed("<div style={{ backgroundColor: \"#000\", maxWidth: '40rem' }} />");
    expect(file.decls.map((d) => [d.prop, d.value])).toEqual([
      ["background-color", "#000"],
      ["max-width", "40rem"],
    ]);
  });

  it("recovers from minor syntax errors", () => {
    const file = parsed("const a = <div className=\"p-4\">ok</div>;\nconst b = 1 +;");
    expect(["ok", "recovered", "fallback"]).toContain(file.parseMode);
    expect(file.classTokens.map((t) => t.raw)).toContain("p-4");
  });

  it("falls back to regex scanning when parsing fails", () => {
    const file = parsed('<div className="bg-black p-4">Hi</div>\n<<<>>> @@@ {');
    expect(file.parseMode).toBe("fallback");
    expect(file.warnings[0]).toMatch(/^parse failed \(.+\); used regex fallback$/);
    expect(file.classTokens.map((t) => t.raw)).toEqual(["bg-black", "p-4"]);
  });

  it("parses plain .jsx files", () => {
    const file = parsed('export default () => <p className="mt-2">x</p>;', "jsx");
    expect(file.parseMode).toBe("ok");
    expect(file.units).toBe(1);
  });
});
