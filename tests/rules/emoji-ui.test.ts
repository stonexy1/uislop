import { describe, expect, it } from "vitest";
import { runRule } from "../helpers";

const rule = "emoji-ui/emoji-in-jsx";

describe("emoji-ui/emoji-in-jsx", () => {
  it("flags an emoji used as an icon as error", () => {
    const [f] = runRule(rule, '<div className="size-12 rounded-xl">🚀</div>');
    expect(f).toMatchObject({ severity: "error", message: 'Emoji "🚀" used as UI icon', line: 1, column: 37 });
  });

  it("flags inline decoration as warn", () => {
    expect(runRule(rule, "<span>✨ New release</span>")[0]).toMatchObject({ severity: "warn", message: 'Emoji "✨" used as UI decoration' });
  });

  it("matches keycaps, flags and skin tones", () => {
    expect(runRule(rule, "<p>Step 1️⃣ done</p>")).toHaveLength(1);
    expect(runRule(rule, "<p>Made in 🇩🇪 today</p>")).toHaveLength(1);
    expect(runRule(rule, "<p>Nice 👍🏽 work</p>")[0]?.message).toContain("👍🏽");
  });

  it("does not match text symbols", () => {
    expect(runRule(rule, "<footer>© 2026 ✓ → ★ — •</footer>")).toHaveLength(0);
  });

  it("skips accessible emoji and option labels", () => {
    expect(runRule(rule, '<span role="img" aria-label="party">🎉</span>')).toHaveLength(0);
    expect(runRule(rule, "<select><option>🇫🇷 French</option></select>")).toHaveLength(0);
  });

  it("checks attributes, props, CSS content and HTML entities", () => {
    expect(runRule(rule, '<img alt="🚀 Launch" />')).toHaveLength(1);
    expect(runRule(rule, 'const f = [{ icon: "🔥" }];')[0]?.severity).toBe("error");
    expect(runRule(rule, '.t::before { content: "✨"; }', "css")).toHaveLength(1);
    expect(runRule(rule, "<span>&#128640;</span>", "html")).toHaveLength(1);
  });

  it("never scans comments or class strings", () => {
    expect(runRule(rule, '// 🚀 note\nconst a = <div className="🚀" />;')).toHaveLength(0);
  });
});
