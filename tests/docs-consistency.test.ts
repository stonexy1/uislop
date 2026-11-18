import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NPX, PKG_NAME, BIN_NAME, BIN_ALIAS, SKILL_NAME } from "../src/meta";
import { ALL_RULES } from "../src/rules/index";
import { ROOT } from "./helpers";

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const readme = read("README.md");
const readmeRu = read("README.ru.md");
const skill = read("skill/SKILL.md");
const pkg = JSON.parse(read("package.json")) as { name: string; bin: Record<string, string> };
const OTHER_TOOLS = new Set(["skills"]);

function frontmatter(text: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error("SKILL.md has no frontmatter");
  return Object.fromEntries(
    (match[1] as string).split("\n").map((line) => {
      const index = line.indexOf(":");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
  );
}

describe("docs consistency", () => {
  it.each([
    ["README.md", readme],
    ["README.ru.md", readmeRu],
    ["skill/SKILL.md", skill],
  ])("%s uses the npx command constant", (_, text) => {
    const commands = [...text.matchAll(/npx ([\w@./-]+)/g)].map((m) => m[1] as string).filter((w) => !OTHER_TOOLS.has(w));
    expect(commands.length).toBeGreaterThan(0);
    for (const word of commands) expect(`npx ${word}`).toBe(NPX);
  });

  it("package.json matches meta", () => {
    expect(pkg.name).toBe(PKG_NAME);
    expect(pkg.bin).toEqual({ [BIN_NAME]: "dist/cli.js", [BIN_ALIAS]: "dist/cli.js" });
  });

  it("documents every rule in both READMEs and SKILL.md", () => {
    for (const rule of ALL_RULES) {
      expect(readme).toContain(`\`${rule.id}\``);
      expect(readmeRu).toContain(`\`${rule.id}\``);
      expect(skill).toContain(`\`${rule.id}\``);
    }
  });

  it("has valid skill frontmatter", () => {
    expect(skill.startsWith("---\n")).toBe(true);
    const fm = frontmatter(skill);
    expect(Object.keys(fm).sort()).toEqual(["allowed-tools", "compatibility", "description", "license", "name"]);
    expect(fm.name).toBe(SKILL_NAME);
    expect(fm.name).toMatch(/^[a-z][a-z0-9-]*$/);
    expect((fm.description ?? "").length).toBeGreaterThan(50);
    expect((fm.description ?? "").length).toBeLessThanOrEqual(1024);
    expect((fm.compatibility ?? "").length).toBeLessThanOrEqual(500);
    expect(skill.split("\n").length).toBeLessThan(200);
  });
});
