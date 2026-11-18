import { describe, expect, it } from "vitest";
import { parsed } from "../helpers";

describe("html parser", () => {
  it("masks comments, script, pre and svg content", () => {
    const file = parsed(
      "<div><!-- hidden 🚀 --><script>const s = '🚀';</script><pre>🚀</pre><svg><text>🚀</text></svg><p>Shown</p></div>",
      "html",
    );
    expect(file.texts.map((t) => t.text)).toEqual(["Shown"]);
    expect(file.allElements.map((e) => e.tag)).toEqual(["div", "script", "pre", "svg", "p"]);
  });

  it("handles void elements and implied end tags", () => {
    const file = parsed("<ul><li>One<li>Two</ul><img src=a.png><p>x", "html");
    const tags = file.allElements.map((e) => `${e.tag}<${e.parent?.tag ?? "root"}`);
    expect(tags).toEqual(["ul<root", "li<ul", "li<ul", "img<root", "p<root"]);
  });

  it("parses <style> blocks with correct line numbers", () => {
    const file = parsed("<html>\n<style>\n.a {\n  color: #000;\n}\n</style>\n</html>", "html");
    expect(file.decls.map((d) => [d.prop, d.line, d.column])).toEqual([["color", 4, 3]]);
  });

  it("decodes numeric entities", () => {
    const file = parsed("<span>&#128640; Launch</span>", "html");
    expect(file.texts[0]?.text).toBe("🚀 Launch");
  });

  it("reads class, style and handler attributes", () => {
    const file = parsed('<button class="px-4 bg-black" style="max-width: 20rem" onclick="return false;">Go</button>', "html");
    const el = file.allElements[0];
    expect(el?.classTokens.map((t) => [t.raw, t.column])).toEqual([
      ["px-4", 16],
      ["bg-black", 21],
    ]);
    expect(file.decls.map((d) => d.prop)).toEqual(["max-width"]);
    expect(el?.attrs.get("onclick")?.handler).toBe("empty");
  });

  it("skips the doctype", () => {
    const file = parsed("<!DOCTYPE html><p>Hi</p>", "html");
    expect(file.texts.map((t) => t.text)).toEqual(["Hi"]);
  });
});
