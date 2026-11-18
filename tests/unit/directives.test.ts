import { describe, expect, it } from "vitest";
import { analyze, runRule } from "../helpers";

const DEAD = "fake-ui/dead-link";

describe("ignore directives", () => {
  it("bare comment on its own line ignores the next line", () => {
    expect(runRule(DEAD, '<nav>\n  {/* uislop-ignore */}\n  <a href="#">x</a>\n  <a href="#">y</a>\n</nav>')).toHaveLength(1);
  });

  it("trailing comment ignores its own line", () => {
    expect(runRule(DEAD, 'const a = <a href="#">x</a>; // uislop-ignore\nconst b = <a href="#">y</a>;')).toHaveLength(1);
  });

  it("supports -next-line, -line and -file", () => {
    expect(runRule(DEAD, '// uislop-ignore-next-line\nconst a = <a href="#">x</a>;')).toHaveLength(0);
    expect(runRule(DEAD, 'const a = <a href="#">x</a>; /* uislop-ignore-line */')).toHaveLength(0);
    expect(runRule(DEAD, 'const a = <a href="#">x</a>;\n// uislop-ignore-file fake-ui\nconst b = <a href="#">y</a>;')).toHaveLength(0);
  });

  it("limits to the listed rules and categories", () => {
    const source = '// uislop-ignore copy-slop\nconst a = <a href="#">Supercharge</a>;';
    const ids = analyze(source).findings.map((f) => f.ruleId);
    expect(ids).toEqual([DEAD]);
    const byRule = analyze('// uislop-ignore: fake-ui/dead-link, copy-slop/cliche-phrase\nconst a = <a href="#">Supercharge</a>;');
    expect(byRule.findings).toHaveLength(0);
  });

  it("treats text after the rule list or -- as a rationale", () => {
    expect(runRule(DEAD, '// uislop-ignore fake-ui -- placeholder until routing lands\nconst a = <a href="#">x</a>;')).toHaveLength(0);
    expect(runRule(DEAD, '// uislop-ignore this is fine\nconst a = <a href="#">x</a>;')).toHaveLength(0);
  });

  it("warns on an unknown rule id and ignores nothing", () => {
    const result = analyze('// uislop-ignore fake-ui/dead-lnk\nconst a = <a href="#">x</a>;');
    expect(result.findings.map((f) => f.ruleId)).toEqual([DEAD]);
    expect(result.parsed.warnings[0]).toContain('unknown rule "fake-ui/dead-lnk"');
  });

  it("covers findings inside a multi-line tag through its anchor line", () => {
    const source = '{/* uislop-ignore color-slop */}\n<div\n  className="p-4\n  bg-gradient-to-r from-indigo-500 to-purple-500"\n/>';
    expect(runRule("color-slop/ai-gradient", `<>\n${source}\n</>`)).toHaveLength(0);
  });

  it("works in CSS and HTML comments", () => {
    expect(runRule("color-slop/pure-black-white", "/* uislop-ignore */\n.a { color: #000; }", "css")).toHaveLength(0);
    expect(runRule(DEAD, '<!-- uislop-ignore -->\n<a href="#">x</a>', "html")).toHaveLength(0);
  });
});
