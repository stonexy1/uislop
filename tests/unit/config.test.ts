import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig, discoverConfig, loadConfig, parseConfig, resolveRule } from "../../src/config";
import { walkFiles } from "../../src/files";
import { ruleById } from "../../src/rules/index";
import { tmpDir } from "../helpers";

describe("config", () => {
  it("returns defaults for an empty object", () => {
    expect(parseConfig("{}").config).toEqual(defaultConfig());
  });

  it("extends exclude and classFunctions", () => {
    const { config } = parseConfig('{"exclude":["legacy/**"],"classFunctions":["cx2"]}');
    expect(config.exclude).toEqual(["legacy/**"]);
    expect(config.classFunctions).toContain("cn");
    expect(config.classFunctions).toContain("cx2");
  });

  it("reports invalid JSON with a position", () => {
    expect(() => parseConfig('{\n  "maxSlop": ,\n}')).toThrow(/^uislop\.config\.json: .* at line 2:\d+$/);
  });

  it.each([
    ['{"maxSlop": 101}', /maxSlop: expected an integer from 0 to 100/],
    ['{"maxSlop": 1.5}', /maxSlop: expected an integer/],
    ['{"rules": {"emoji-ui": "loud"}}', /rules\.emoji-ui: expected "off"\|"error"\|"warn"\|"info"/],
    ['{"rules": {"emoji-ui": {"weight": -1}}}', /rules\.emoji-ui\.weight/],
    ['{"include": "src"}', /include: expected an array of strings/],
    ['{"ignore": [{"rules": []}]}', /ignore\[0\]\.files/],
    ["[]", /expected a JSON object/],
  ])("rejects %s", (text, pattern) => {
    expect(() => parseConfig(text)).toThrow(pattern);
  });

  it("warns on unknown keys, rules and options with a suggestion", () => {
    const { warnings } = parseConfig('{"colour": 1, "rules": {"fake-ui/dead-links": "off", "layout-slop/heavy-shadow": {"options": {"minCnt": 3}}}}');
    expect(warnings).toEqual([
      "uislop.config.json: colour: unknown key, ignored",
      'uislop.config.json: rules.fake-ui/dead-links: unknown rule, ignored (did you mean "fake-ui/dead-link"?)',
      "uislop.config.json: rules.layout-slop/heavy-shadow.options.minCnt: unknown option, ignored",
    ]);
  });

  it("resolves rule id before category before default", () => {
    const rule = ruleById("copy-slop/cliche-phrase");
    if (!rule) throw new Error("missing rule");
    const { config } = parseConfig('{"rules": {"copy-slop": "off", "copy-slop/cliche-phrase": {"weight": 3}}}');
    expect(resolveRule(rule, config)).toMatchObject({ severity: "warn", weight: 3, severityOverride: false });
    const off = parseConfig('{"rules": {"copy-slop": "off"}}').config;
    expect(resolveRule(rule, off)).toBeNull();
  });

  it("discovers the config file up to the package root", () => {
    const dir = tmpDir();
    mkdirSync(join(dir, "app", "src"), { recursive: true });
    writeFileSync(join(dir, "app", "package.json"), "{}");
    writeFileSync(join(dir, "uislop.config.json"), "{}");
    expect(discoverConfig(join(dir, "app", "src"))).toBeNull();
    writeFileSync(join(dir, "app", "uislop.config.json"), '{"maxSlop": 10}');
    expect(discoverConfig(join(dir, "app", "src"))).toBe(join(dir, "app", "uislop.config.json"));
    expect(loadConfig(join(dir, "app", "src")).config.maxSlop).toBe(10);
  });
});

describe("file walker", () => {
  it("prunes build and dot directories, skips symlinks and default excludes", () => {
    const dir = tmpDir();
    for (const d of ["src", "node_modules/x", ".next", "dist", "src/__tests__"]) mkdirSync(join(dir, d), { recursive: true });
    for (const f of ["src/a.tsx", "src/b.css", "src/c.ts", "src/a.test.tsx", "src/__tests__/d.tsx", "node_modules/x/e.tsx", ".next/f.tsx", "dist/g.html"]) {
      writeFileSync(join(dir, f), "");
    }
    symlinkSync(join(dir, "src"), join(dir, "linked"));
    const files = walkFiles(dir, [dir], defaultConfig());
    expect(files.map((f) => f.rel)).toEqual(["src/a.tsx", "src/b.css"]);
  });

  it("scans a pruned directory when passed explicitly", () => {
    const dir = tmpDir();
    mkdirSync(join(dir, "dist"));
    writeFileSync(join(dir, "dist", "x.html"), "");
    const files = walkFiles(join(dir, "dist"), [join(dir, "dist")], defaultConfig());
    expect(files.map((f) => f.rel)).toEqual(["x.html"]);
  });
});
