import { describe, expect, it } from "vitest";
import { globToRegExp, matchesAny } from "../../src/glob";

describe("glob", () => {
  it.each([
    ["**", "a/b/c.tsx", true],
    ["**/*.test.*", "src/a.test.tsx", true],
    ["**/*.test.*", "a.test.tsx", true],
    ["*.stories.*", "src/ui/Button.stories.tsx", true],
    ["src/marketing/**", "src/marketing/Hero.tsx", true],
    ["src/marketing/**", "src/app/Hero.tsx", false],
    ["src/*.tsx", "src/a/b.tsx", false],
    ["src/{a,b}.css", "src/b.css", true],
    ["src/legacy", "src/legacy/x.tsx", true],
    ["**/__tests__/**", "src/__tests__/x.tsx", true],
  ])("%s matches %s: %s", (pattern, path, expected) => {
    expect(globToRegExp(pattern).test(path)).toBe(expected);
  });

  it("matches any of several patterns", () => {
    expect(matchesAny("a/b.min.css", ["**/*.test.*", "**/*.min.*"])).toBe(true);
  });
});
