import { IGNORE_KEYWORD } from "../meta";
import type { Directive, Finding, LineIndex } from "../types";

export interface RawComment {
  value: string;
  start: number;
  end: number;
}

export interface DirectiveContext {
  isKnownId(id: string): boolean;
  warn(message: string): void;
}

const DIRECTIVE_RE = new RegExp(`^${IGNORE_KEYWORD}(-next-line|-line|-file)?(?![\\w-])(.*)$`, "s");
const ID_LIKE_RE = /\/|^[a-z]+-(slop|ui)$/;

function parseRuleList(rest: string, ctx: DirectiveContext, line: number): string[] | "all" | null {
  const [list = ""] = rest.split("--");
  const tokens = list.replace(/^\s*:/, "").split(/[\s,]+/).filter(Boolean);
  const rules: string[] = [];
  for (const token of tokens) {
    if (ctx.isKnownId(token)) {
      rules.push(token);
      continue;
    }
    if (rules.length === 0 && ID_LIKE_RE.test(token)) {
      ctx.warn(`line ${line}: unknown rule "${token}" in ignore directive`);
      return null;
    }
    break;
  }
  return rules.length > 0 ? rules : "all";
}

export function parseDirectives(comments: RawComment[], source: string, lines: LineIndex, ctx: DirectiveContext): Directive[] {
  const directives: Directive[] = [];
  for (const comment of comments) {
    const body = comment.value.replace(/^[\s*]+/, "").replace(/\s+$/, "");
    const match = DIRECTIVE_RE.exec(body);
    if (!match) continue;
    const start = lines.pos(comment.start);
    const end = lines.pos(Math.max(comment.start, comment.end - 1));
    const rules = parseRuleList(match[2] ?? "", ctx, start.line);
    if (rules === null) continue;
    const suffix = match[1];
    const before = source.slice(comment.start - (start.column - 1), comment.start).trim();
    const alone = before === "" || before === "{";
    let kind: Directive["kind"];
    if (suffix === "-file") kind = "file";
    else if (suffix === "-line") kind = "line";
    else if (suffix === "-next-line") kind = "next-line";
    else kind = alone ? "next-line" : "line";
    const targetLine = kind === "file" ? null : kind === "line" ? start.line : end.line + 1;
    directives.push({ kind, rules, targetLine, commentLine: start.line });
  }
  return directives;
}

function ruleMatches(rules: Directive["rules"], ruleId: string): boolean {
  if (rules === "all") return true;
  return rules.some((id) => id === ruleId || ruleId.startsWith(`${id}/`));
}

export function isSuppressed(finding: Finding, directives: Directive[]): boolean {
  return directives.some((d) => {
    if (!ruleMatches(d.rules, finding.ruleId)) return false;
    if (d.kind === "file") return true;
    return finding.line === d.targetLine || finding.anchorLine === d.targetLine;
  });
}
