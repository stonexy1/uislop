import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defaultConfig } from "../src/config";
import { analyzeSource } from "../src/scan";
import type { FileKind, Finding, ParsedFile, UislopConfig } from "../src/types";

export const ROOT = resolve(import.meta.dirname, "..");

export function fx(name: "dirty" | "clean"): string {
  return join(ROOT, "tests", "fixtures", name);
}

export function tmpDir(prefix = "slopscan-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function entryFor(kind: FileKind, source: string) {
  return { abs: `/virtual/file.${kind}`, rel: `file.${kind}`, kind, size: source.length };
}

export function analyze(source: string, kind: FileKind = "tsx", config: UislopConfig = defaultConfig()): { parsed: ParsedFile; findings: Finding[] } {
  return analyzeSource(entryFor(kind, source), source, config);
}

export function parsed(source: string, kind: FileKind = "tsx"): ParsedFile {
  return analyze(source, kind).parsed;
}

export function findings(source: string, kind: FileKind = "tsx", config?: UislopConfig): Finding[] {
  return analyze(source, kind, config).findings;
}

export function runRule(ruleId: string, source: string, kind: FileKind = "tsx", config?: UislopConfig): Finding[] {
  return findings(source, kind, config).filter((f) => f.ruleId === ruleId);
}
