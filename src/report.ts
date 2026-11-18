import { NPX, TARGET_SLOP, VERSION, BRAND, PKG_NAME } from "./meta";
import type { Style } from "./ui/style";
import type { FileResult, Finding, ScanResult } from "./types";

const FILE_CAP = 12;
const TOTAL_CAP = 60;
const RULE_COLUMN_CAP = 34;

export interface CiOutcome {
  threshold: number;
  passed: boolean;
  maxFileSlop: number | null;
  failingFile: FileResult | null;
}

export interface ReportOptions {
  style: Style;
  displayPath: string;
  columns?: number;
  all: boolean;
  fixPrompt: string | null;
  ci: CiOutcome | null;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function truncate(text: string, max: number): string {
  if (max <= 1) return "…";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function pickRows(findings: Finding[], limit: number): Finding[] {
  if (findings.length <= limit) return findings;
  return [...findings]
    .sort((a, b) => b.points - a.points || a.line - b.line || a.column - b.column)
    .slice(0, limit)
    .sort((a, b) => a.line - b.line || a.column - b.column);
}

export function promptCommand(displayPath: string): string {
  return displayPath === "." ? `${NPX} --prompt` : `${NPX} ${displayPath} --prompt`;
}

export function ciLine(ci: CiOutcome, score: number, style: Style): string {
  if (ci.passed) return style.accent(`CI check passed: score ${score} <= max ${ci.threshold}`);
  const parts = [score > ci.threshold ? `score ${score} > max ${ci.threshold}` : `score ${score} <= max ${ci.threshold}`];
  if (ci.failingFile && ci.maxFileSlop !== null) {
    parts.push(`worst file ${ci.failingFile.path} ${ci.failingFile.score} > ${ci.maxFileSlop}`);
  }
  return style.red(`CI check failed: ${parts.join("; ")}`);
}

export function renderReport(result: ScanResult, options: ReportOptions): string {
  const { style, all } = options;
  const width = Math.min(140, Math.max(80, options.columns ?? 100));
  const { score } = result;
  const out: string[] = [];
  const fileCount = score.files.length;
  out.push(style.dim(`${BRAND} ${VERSION}  ${options.displayPath} · ${plural(fileCount, "file")} · ${plural(score.units, "UI element")}`));
  if (fileCount === 0) out.push("", `No .tsx/.jsx/.css/.html files found in ${options.displayPath}`);

  const byFile = new Map<string, Finding[]>();
  for (const f of result.findings) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  const sections = score.files.filter((f) => byFile.has(f.path));
  const plans = [] as { file: FileResult; rows: Finding[]; hidden: number }[];
  let budget = all ? Number.POSITIVE_INFINITY : TOTAL_CAP;
  for (const file of sections) {
    const findings = byFile.get(file.path) as Finding[];
    const limit = all ? findings.length : Math.max(0, Math.min(FILE_CAP, budget));
    const rows = pickRows(findings, limit);
    budget -= rows.length;
    plans.push({ file, rows, hidden: findings.length - rows.length });
  }
  const ruleWidth = Math.min(RULE_COLUMN_CAP, Math.max(0, ...plans.flatMap((p) => p.rows.map((r) => r.ruleId.length))));

  for (const { file, rows, hidden } of plans) {
    out.push("", `${style.bold(file.path)}  ${style.dim(`${plural(file.findings, "finding")} · score ${file.score}`)}`);
    for (const f of rows) {
      const location = `${f.line}:${f.column}`.padEnd(7);
      const severity = f.severity.padEnd(5);
      const rule = f.ruleId.padEnd(ruleWidth);
      const prefixLength = 2 + 7 + 2 + 5 + 2 + Math.max(ruleWidth, f.ruleId.length) + 2;
      const message = truncate(f.message, width - prefixLength);
      out.push(`  ${location}  ${f.severity === "error" ? style.red(severity) : severity}  ${rule}  ${message}`);
    }
    if (hidden > 0) out.push(style.dim(`  … ${hidden} more in this file (run with --all)`));
  }

  const categories = score.categories.filter((c) => c.findings > 0);
  if (categories.length > 0) {
    out.push("", style.dim(`${"Category".padEnd(16)}Findings  Points`));
    for (const c of categories) out.push(`${c.id.padEnd(16)}${String(c.findings).padStart(8)}  ${String(c.points).padStart(6)}`);
  }

  out.push("", `Slop Score  ${style.accent(`${score.score}/100  ${score.tierLabel}`)}`);
  if (result.findings.length === 0) out.push("No findings.");
  const worst = score.files.find((f) => f.path === score.worstFile);
  if (worst) out.push(style.dim(`Worst file  ${worst.path} (${worst.score})`));
  out.push(style.dim(`Done in ${result.durationMs} ms`));
  if (options.ci) out.push(ciLine(options.ci, score.score, style));

  if (result.findings.length > 0 && score.score <= TARGET_SLOP) {
    out.push(style.dim(`${plural(result.findings.length, "minor finding")}. Run ${promptCommand(options.displayPath)} for a fix prompt.`));
  } else if (options.fixPrompt) {
    const rule = style.dim("─".repeat(width));
    out.push(
      "",
      `${style.bold("Fix prompt")}  ${style.dim(`copy into Claude Code or Cursor, or run: ${promptCommand(options.displayPath)}`)}`,
      rule,
      options.fixPrompt,
      rule,
    );
  }
  return `${out.join("\n")}\n`;
}

export function renderQuiet(result: ScanResult): string {
  return `${result.score.score}/100 ${result.score.tierLabel}\n`;
}

export interface JsonOptions {
  maxSlop: number | null;
  passed: boolean | null;
}

export function renderJson(result: ScanResult, options: JsonOptions): string {
  const { score } = result;
  const payload = {
    schemaVersion: 1,
    tool: { name: PKG_NAME, version: VERSION },
    root: result.root,
    configPath: result.configPath,
    durationMs: result.durationMs,
    score: {
      value: score.score,
      tier: score.tier,
      tierLabel: score.tierLabel,
      raw: score.raw,
      units: score.units,
      density: score.density,
      maxSlop: options.maxSlop,
      passed: options.passed,
    },
    categories: score.categories,
    files: score.files.map((f) => ({
      path: f.path,
      kind: f.kind,
      units: f.units,
      findings: f.findings,
      raw: f.raw,
      score: f.score,
      parse: f.parseMode,
    })),
    findings: result.findings.map((f) => ({
      ruleId: f.ruleId,
      category: f.category,
      severity: f.severity,
      message: f.message,
      file: f.file,
      line: f.line,
      column: f.column,
      endLine: f.endLine ?? f.line,
      snippet: f.snippet,
      fixHint: f.fixHint,
      points: f.points,
    })),
    warnings: result.warnings,
    stats: result.stats,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}
