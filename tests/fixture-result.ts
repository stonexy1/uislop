import type { Finding, ScanResult } from "../src/types";

function f(file: string, line: number, ruleId: string, points: number, message: string): Finding {
  const [category] = ruleId.split("/") as [Finding["category"]];
  return {
    ruleId,
    category,
    severity: points >= 4.5 ? "error" : "warn",
    message,
    file,
    line,
    column: 5,
    snippet: "<div>",
    fixHint: `Fix for ${ruleId}.`,
    points,
  };
}

export function sampleResult(): ScanResult {
  const findings: Finding[] = [
    f("src/Landing.tsx", 14, "color-slop/ai-gradient", 4.5, "Gradient from-indigo-500 to-purple-500 is the default AI palette"),
    f("src/Landing.tsx", 20, "layout-slop/template-hero", 4.5, 'Template hero: centered headline with pill badge and "Get Started"/"Learn More" buttons'),
    f("src/Landing.tsx", 31, "fake-ui/dead-link", 2, 'Dead link: href="#"'),
    f("src/Landing.tsx", 44, "copy-slop/cliche-phrase", 2, 'LLM cliché "supercharge"'),
    f("src/Dashboard.tsx", 8, "fake-ui/noop-handler", 2, "Button does nothing: onClick handler is empty"),
    f("src/Dashboard.tsx", 12, "typo-slop/missing-tabular-nums", 1, 'Number "$1,299" without tabular-nums'),
    f("src/styles.css", 2, "color-slop/neon-shadow", 2, "Neon tinted shadow box-shadow: 0 0 30px rgba(139, 92, 246, 0.5) (colored glow)"),
  ];
  return {
    root: "/repo",
    configPath: null,
    durationMs: 12,
    findings,
    warnings: [],
    stats: { filesScanned: 3, filesSkipped: 0 },
    score: {
      score: 47,
      tier: "template-vibe",
      tierLabel: "Template Vibe",
      raw: 18,
      units: 60,
      density: 0.3,
      worstFile: "src/Landing.tsx",
      categories: [
        { id: "color-slop", findings: 2, raw: 6.5, points: 17 },
        { id: "fake-ui", findings: 2, raw: 4, points: 10 },
        { id: "layout-slop", findings: 1, raw: 4.5, points: 12 },
        { id: "copy-slop", findings: 1, raw: 2, points: 5 },
        { id: "typo-slop", findings: 1, raw: 1, points: 3 },
        { id: "emoji-ui", findings: 0, raw: 0, points: 0 },
      ],
      files: [
        { path: "src/Landing.tsx", kind: "tsx", units: 30, findings: 4, raw: 13, score: 41, parseMode: "ok" },
        { path: "src/Dashboard.tsx", kind: "tsx", units: 20, findings: 2, raw: 3, score: 11, parseMode: "ok" },
        { path: "src/styles.css", kind: "css", units: 10, findings: 1, raw: 2, score: 8, parseMode: "ok" },
      ],
    },
  };
}
