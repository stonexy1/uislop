import { nextGroup, tokenizeClassString } from "./classes";
import { splitTopLevel } from "./color";
import { addClassTokens, emptyFacts, type Facts } from "./facts";
import type { RawComment } from "./directives";
import type { CssDecl, LineIndex } from "../types";

const SKIPPED_AT_RULES = new Set(["font-face", "import", "charset", "tailwind"]);
const TRANSPARENT_AT_RULES = new Set(["layer", "theme"]);

interface Frame {
  selector: string;
  atRule: string | null;
  blockId: number;
  skip: boolean;
  declCount: number;
}

const COMMENT_OR_STRING_RE = /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\/\*([\s\S]*?)(?:\*\/|$)/g;

export function maskCss(text: string): { masked: string; comments: RawComment[] } {
  const comments: RawComment[] = [];
  if (!text.includes("/*")) return { masked: text, comments };
  const masked = text.replace(COMMENT_OR_STRING_RE, (match: string, body: string | undefined, offset: number) => {
    if (body === undefined) return match;
    comments.push({ value: body, start: offset, end: offset + match.length });
    return match.replace(/[^\n]/g, " ");
  });
  return { masked, comments };
}

export function scanCss(text: string, baseOffset: number, lines: LineIndex, facts: Facts): number {
  const { masked, comments } = maskCss(text);
  for (const comment of comments) {
    facts.comments.push({ value: comment.value, start: comment.start + baseOffset, end: comment.end + baseOffset });
  }
  const root: Frame = { selector: "", atRule: null, blockId: baseOffset, skip: false, declCount: 0 };
  const stack: Frame[] = [root];
  let blocks = 0;
  let segStart = 0;
  let depth = 0;
  let quote: string | null = null;

  const statement = (start: number, end: number, frame: Frame): void => {
    if (frame.skip || frame === root) return;
    const raw = masked.slice(start, end);
    const trimmed = raw.trim();
    if (!trimmed) return;
    const offset = start + raw.search(/\S/);
    if (trimmed.startsWith("@apply")) {
      const listStart = offset + "@apply".length;
      const list = masked.slice(listStart, end).replace(/!important/g, (m) => " ".repeat(m.length));
      addClassTokens(facts, tokenizeClassString(list, listStart + baseOffset, lines, "apply", nextGroup()));
      return;
    }
    if (trimmed.startsWith("@")) return;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) return;
    const prop = trimmed.slice(0, colon).trim();
    if (!/^-{0,2}[a-zA-Z][\w-]*$/.test(prop)) return;
    const pos = lines.pos(offset + baseOffset);
    facts.decls.push({
      prop: prop.startsWith("--") ? prop : prop.toLowerCase(),
      value: trimmed.slice(colon + 1).trim(),
      line: pos.line,
      column: pos.column,
      offset: offset + baseOffset,
      selector: frame.selector,
      atRule: frame.atRule,
      blockId: frame.blockId,
    });
    frame.declCount++;
  };

  const open = (header: string, at: number, parent: Frame): Frame => {
    if (parent.skip) return { ...parent, declCount: 0 };
    const atMatch = /^@([\w-]+)/.exec(header);
    if (!atMatch) {
      return { selector: header, atRule: parent.atRule, blockId: baseOffset + at, skip: false, declCount: 0 };
    }
    const name = (atMatch[1] as string).toLowerCase();
    if (SKIPPED_AT_RULES.has(name)) return { ...parent, skip: true, declCount: 0 };
    if (TRANSPARENT_AT_RULES.has(name)) return { ...parent, declCount: 0, blockId: baseOffset + at };
    return { selector: parent.selector, atRule: header, blockId: baseOffset + at, skip: false, declCount: 0 };
  };

  for (let i = 0; i < masked.length; i++) {
    const c = masked[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    if (depth > 0) continue;
    const top = stack[stack.length - 1] as Frame;
    if (c === "{") {
      stack.push(open(masked.slice(segStart, i).trim(), i, top));
      segStart = i + 1;
    } else if (c === ";") {
      statement(segStart, i, top);
      segStart = i + 1;
    } else if (c === "}") {
      statement(segStart, i, top);
      if (stack.length > 1) {
        const closed = stack.pop() as Frame;
        if (closed.declCount > 0) blocks++;
      }
      segStart = i + 1;
    }
  }
  return blocks;
}

export function parseInlineStyle(value: string, valueOffset: number, lines: LineIndex, blockId: number): CssDecl[] {
  const decls: CssDecl[] = [];
  let cursor = 0;
  for (const part of splitTopLevel(value, ";")) {
    const index = value.indexOf(part, cursor);
    cursor = index + part.length;
    const colon = part.indexOf(":");
    if (colon <= 0) continue;
    const pos = lines.pos(valueOffset + index);
    decls.push({
      prop: part.slice(0, colon).trim().toLowerCase(),
      value: part.slice(colon + 1).trim(),
      line: pos.line,
      column: pos.column,
      offset: valueOffset + index,
      selector: "",
      atRule: null,
      blockId,
    });
  }
  return decls;
}

export function parseCssFile(source: string, lines: LineIndex): Facts {
  const facts = emptyFacts();
  facts.units = scanCss(source, 0, lines, facts);
  return facts;
}
