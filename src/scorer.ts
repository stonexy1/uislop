import { CATEGORIES } from "./rules/index";
import type { Category, CategoryScore, FileResult, Finding, ParsedFile, ScoreResult, Severity, TierId } from "./types";

export const SCORING = { K: 2.0, U_MIN: 50, SEVERITY_MULT: { error: 1.5, warn: 1.0, info: 0.5 } } as const;

export const TIERS: readonly { id: TierId; label: string; max: number }[] = [
  { id: "bespoke-craft", label: "Bespoke Craft", max: 15 },
  { id: "minor-slop", label: "Minor Slop", max: 35 },
  { id: "template-vibe", label: "Template Vibe", max: 60 },
  { id: "pure-ai-slop", label: "Pure AI Slop", max: 100 },
];

export function pointsFor(weight: number, severity: Severity): number {
  return weight * SCORING.SEVERITY_MULT[severity];
}

export function densityOf(raw: number, units: number): number {
  return raw / Math.max(SCORING.U_MIN, units);
}

export function computeScore(raw: number, units: number): number {
  if (raw <= 0) return 0;
  const score = Math.round(100 * (1 - Math.exp(-SCORING.K * densityOf(raw, units))));
  return Math.min(100, Math.max(0, score));
}

export function tierFor(score: number): { id: TierId; label: string } {
  const tier = TIERS.find((t) => score <= t.max) ?? (TIERS[TIERS.length - 1] as (typeof TIERS)[number]);
  return { id: tier.id, label: tier.label };
}

export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map(Math.floor);
  let remaining = total - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((value, i) => ({ i, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floors[i] = (floors[i] as number) + 1;
    remaining--;
  }
  return floors;
}

export type ScoredFile = Pick<ParsedFile, "units" | "kind" | "parseMode"> & { path: string };

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function scoreFindings(findings: Finding[], files: ScoredFile[]): ScoreResult {
  const raw = findings.reduce((sum, f) => sum + f.points, 0);
  const units = files.reduce((sum, f) => sum + f.units, 0);
  const score = computeScore(raw, units);
  const tier = tierFor(score);

  const categoryRaw = CATEGORIES.map((id) => findings.filter((f) => f.category === id));
  const points = allocate(score, categoryRaw.map((list) => list.reduce((s, f) => s + f.points, 0)));
  const categories: CategoryScore[] = CATEGORIES.map((id: Category, i) => ({
    id,
    findings: (categoryRaw[i] as Finding[]).length,
    raw: round((categoryRaw[i] as Finding[]).reduce((s, f) => s + f.points, 0), 2),
    points: points[i] as number,
  })).sort((a, b) => b.points - a.points || b.raw - a.raw || CATEGORIES.indexOf(a.id) - CATEGORIES.indexOf(b.id));

  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byFile.get(f.file);
    if (list) list.push(f);
    else byFile.set(f.file, [f]);
  }
  const fileResults: FileResult[] = files
    .map((file) => {
      const own = byFile.get(file.path) ?? [];
      const fileRaw = own.reduce((s, f) => s + f.points, 0);
      return {
        path: file.path,
        kind: file.kind,
        units: file.units,
        findings: own.length,
        raw: round(fileRaw, 2),
        score: computeScore(fileRaw, file.units),
        parseMode: file.parseMode,
      };
    })
    .sort((a, b) => b.score - a.score || b.raw - a.raw || (a.path < b.path ? -1 : 1));
  const worst = fileResults.find((f) => f.findings > 0);

  return {
    score,
    tier: tier.id,
    tierLabel: tier.label,
    raw: round(raw, 2),
    units,
    density: round(densityOf(raw, units), 3),
    categories,
    files: fileResults,
    worstFile: worst ? worst.path : null,
  };
}
