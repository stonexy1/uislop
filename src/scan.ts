import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig, resolveRule, type ResolvedRule } from "./config";
import { UsageError } from "./errors";
import { walkFiles } from "./files";
import { matchesAny } from "./glob";
import { isSuppressed } from "./parse/directives";
import { parseFile } from "./parse/index";
import { collapseWhitespace } from "./parse/text";
import { ALL_RULES, isKnownRuleId } from "./rules/index";
import { pointsFor, scoreFindings, type ScoredFile } from "./scorer";
import type { ElementNode, FileEntry, Finding, ParsedFile, Rule, RuleContext, ScanResult, ScanWarning, UislopConfig } from "./types";

export const MAX_PER_RULE_FILE = 50;
const MINIFIED_MIN_SIZE = 50_000;
const MINIFIED_AVG_LINE = 500;
const SNIPPET_MAX = 120;

export interface ScanOptions {
  paths: string[];
  cwd?: string;
  configPath?: string;
  config?: UislopConfig;
}

export interface ScanRun {
  result: ScanResult;
  config: UislopConfig;
}

function snippetOf(file: ParsedFile, line: number): string {
  const text = file.lines.lineText(line).trim();
  return text.length > SNIPPET_MAX ? `${text.slice(0, SNIPPET_MAX - 1)}…` : text;
}

function createContext(file: ParsedFile, rule: Rule, resolved: ResolvedRule, sink: Finding[]): RuleContext {
  const textCache = new Map<ElementNode, string>();
  function* ancestors(el: ElementNode): Iterable<ElementNode> {
    for (let node = el.parent; node; node = node.parent) yield node;
  }
  const textOf = (el: ElementNode): string => {
    const cached = textCache.get(el);
    if (cached !== undefined) return cached;
    const text = collapseWhitespace([...el.texts.map((t) => t.text), ...el.children.map(textOf)].join(" "));
    textCache.set(el, text);
    return text;
  };
  return {
    file,
    options: resolved.options,
    ancestors,
    textOf,
    classesOf: (el) => el.classTokens,
    hasClassInChain: (el, pred) => [el, ...ancestors(el)].some((node) => node.classTokens.some(pred)),
    report(args) {
      const severity = resolved.severityOverride ? resolved.severity : (args.severity ?? resolved.severity);
      const finding: Finding = {
        ruleId: rule.id,
        category: rule.category,
        severity,
        message: args.message,
        file: file.entry.rel,
        line: args.line,
        column: args.column,
        snippet: snippetOf(file, args.line),
        fixHint: args.fixHint ?? rule.fixHint,
        points: pointsFor(resolved.weight, severity),
      };
      if (args.endLine !== undefined) finding.endLine = args.endLine;
      if (args.anchorLine !== undefined) finding.anchorLine = args.anchorLine;
      sink.push(finding);
    },
  };
}

function compareFindings(a: Finding, b: Finding): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  return a.line - b.line || a.column - b.column || (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0);
}

function ignoredByConfig(finding: Finding, config: UislopConfig): boolean {
  if (config.ignore.length === 0 && config.ignoreText.length === 0) return false;
  const configIgnored = config.ignore.some(
    (entry) =>
      matchesAny(finding.file, entry.files) &&
      (!entry.rules || entry.rules.some((id) => id === finding.ruleId || id === finding.category)),
  );
  if (configIgnored) return true;
  const snippet = finding.snippet.toLowerCase();
  return config.ignoreText.some((text) => snippet.includes(text.toLowerCase()));
}

function finalizeFileFindings(raw: Finding[], file: ParsedFile, config: UislopConfig): Finding[] {
  const seen = new Set<string>();
  const perRule = new Map<string, number>();
  const out: Finding[] = [];
  for (const finding of raw.sort(compareFindings)) {
    if (isSuppressed(finding, file.directives) || ignoredByConfig(finding, config)) continue;
    const key = `${finding.ruleId}:${finding.line}:${finding.column}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const count = perRule.get(finding.ruleId) ?? 0;
    if (count >= MAX_PER_RULE_FILE) continue;
    perRule.set(finding.ruleId, count + 1);
    out.push(finding);
  }
  return out;
}

function readSource(entry: FileEntry, config: UislopConfig): { source: string } | { skip: string } {
  if (entry.size > config.maxFileSize) return { skip: `skipped: ${entry.size} bytes exceeds maxFileSize ${config.maxFileSize}` };
  const source = readFileSync(entry.abs, "utf8").replace(/^﻿/, "");
  if (entry.size > MINIFIED_MIN_SIZE) {
    const lineCount = source.split("\n").length;
    if (source.length / lineCount > MINIFIED_AVG_LINE) return { skip: "skipped: looks minified" };
  }
  return { source };
}

interface ActiveRule {
  rule: Rule;
  resolved: ResolvedRule;
}

function activeRules(config: UislopConfig): ActiveRule[] {
  return ALL_RULES.map((rule) => ({ rule, resolved: resolveRule(rule, config) })).filter(
    (r): r is ActiveRule => r.resolved !== null,
  );
}

export function analyzeSource(
  entry: FileEntry,
  source: string,
  config: UislopConfig,
  rules: ActiveRule[] = activeRules(config),
): { parsed: ParsedFile; findings: Finding[] } {
  const parsed = parseFile(entry, source, { classFunctions: config.classFunctions, isKnownId: isKnownRuleId });
  const raw: Finding[] = [];
  for (const { rule, resolved } of rules) {
    if (rule.appliesTo.includes(entry.kind)) rule.check(createContext(parsed, rule, resolved, raw));
  }
  return { parsed, findings: finalizeFileFindings(raw, parsed, config) };
}

export function runScan(options: ScanOptions): ScanRun {
  const started = performance.now();
  const cwd = options.cwd ?? process.cwd();
  const targets = (options.paths.length > 0 ? options.paths : ["."]).map((p) => {
    const abs = resolve(cwd, p);
    if (!existsSync(abs)) throw new UsageError(`Path not found: ${p}`);
    return abs;
  });
  const first = targets[0] as string;
  const root = targets.length === 1 ? (statSync(first).isDirectory() ? first : dirname(first)) : cwd;
  const loaded = options.config
    ? { config: options.config, path: null, warnings: [] as string[] }
    : loadConfig(root, options.configPath ? resolve(cwd, options.configPath) : undefined);
  const config = loaded.config;
  const warnings: ScanWarning[] = loaded.warnings.map((message) => ({ message }));
  const rules = activeRules(config);

  const files = walkFiles(root, targets, config);
  const findings: Finding[] = [];
  const scored: ScoredFile[] = [];
  let filesSkipped = 0;

  for (const entry of files) {
    const read = readSource(entry, config);
    if ("skip" in read) {
      filesSkipped++;
      warnings.push({ file: entry.rel, message: read.skip });
      scored.push({ path: entry.rel, kind: entry.kind, units: 0, parseMode: "skipped" });
      continue;
    }
    const { parsed, findings: fileFindings } = analyzeSource(entry, read.source, config, rules);
    for (const message of parsed.warnings) warnings.push({ file: entry.rel, message });
    findings.push(...fileFindings);
    scored.push({ path: entry.rel, kind: entry.kind, units: parsed.units, parseMode: parsed.parseMode });
  }

  findings.sort(compareFindings);
  const result: ScanResult = {
    root,
    configPath: loaded.path,
    durationMs: Math.round(performance.now() - started),
    findings,
    score: scoreFindings(findings, scored),
    warnings,
    stats: { filesScanned: files.length - filesSkipped, filesSkipped },
  };
  return { result, config };
}

export function scan(options: ScanOptions): ScanResult {
  return runScan(options).result;
}
