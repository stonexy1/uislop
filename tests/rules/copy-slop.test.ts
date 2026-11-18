import { describe, expect, it } from "vitest";
import { runRule } from "../helpers";

describe("copy-slop/cliche-phrase", () => {
  const rule = "copy-slop/cliche-phrase";
  it("flags stock phrases with normalized hyphens and case", () => {
    expect(runRule(rule, "<h1>Supercharge your workflow</h1>")[0]?.message).toBe('LLM cliché "supercharge"');
    expect(runRule(rule, "<p>The Next-Generation platform</p>")[0]?.message).toBe('LLM cliché "next generation"');
    expect(runRule(rule, "<p>In today’s fast-paced world</p>").map((f) => f.message)).toEqual([
      'LLM cliché "in today s fast paced"',
      'LLM cliché "fast paced world"',
    ]);
  });

  it("reads object props and reports one finding per phrase per text", () => {
    expect(runRule(rule, 'const f = [{ title: "Revolutionize revolutionize" }];')).toHaveLength(1);
  });

  it("ignores plain copy", () => {
    expect(runRule(rule, "<p>Track deploys and roll back in one click.</p>")).toHaveLength(0);
  });
});

describe("copy-slop/placeholder-content", () => {
  const rule = "copy-slop/placeholder-content";
  it("flags placeholder names and filler", () => {
    expect(runRule(rule, "<p>Acme Corp hired John Doe. Lorem ipsum.</p>").map((f) => f.message)).toEqual([
      'Placeholder content "Acme Corp"',
      'Placeholder content "John Doe"',
      'Placeholder content "Lorem ipsum"',
    ]);
    expect(runRule(rule, "<p>Call (555) 123-4567</p>")).toHaveLength(1);
    expect(runRule(rule, "<p>Write to hello@example.com</p>")).toHaveLength(1);
  });

  it("allows example emails in input placeholders", () => {
    expect(runRule(rule, '<input placeholder="you@example.com" />')).toHaveLength(0);
  });
});

describe("copy-slop/buzzword-density", () => {
  const rule = "copy-slop/buzzword-density";
  it("flags two or more distinct buzzwords in one text", () => {
    expect(runRule(rule, "<p>Powerful, seamless, intuitive.</p>")[0]?.message).toBe('Buzzword stacking ("powerful, seamless, intuitive")');
  });

  it("does not double count a buzzword inside a cliché", () => {
    expect(runRule(rule, "<p>A seamless experience.</p>")).toHaveLength(0);
    expect(runRule(rule, "<p>A robust API.</p>")).toHaveLength(0);
  });
});
