import type { ClassToken, ParsedFile, Pos } from "../types";

const groupCache = new WeakMap<ClassToken[], ClassToken[][]>();

export function groupTokens(tokens: ClassToken[]): ClassToken[][] {
  const cached = groupCache.get(tokens);
  if (cached) return cached;
  const result = buildGroups(tokens);
  groupCache.set(tokens, result);
  return result;
}

function buildGroups(tokens: ClassToken[]): ClassToken[][] {
  const groups = new Map<string, ClassToken[]>();
  for (const token of tokens) {
    const key = token.owner ? `e${token.owner.id}` : `g${token.group}`;
    const list = groups.get(key);
    if (list) list.push(token);
    else groups.set(key, [token]);
  }
  return [...groups.values()];
}

export function anchorOf(token: ClassToken): number {
  return token.owner?.line ?? token.line;
}

export function hasToken(tokens: ClassToken[], pred: (t: ClassToken) => boolean): boolean {
  return tokens.some(pred);
}

export function coreIs(...cores: string[]): (t: ClassToken) => boolean {
  const set = new Set(cores);
  return (t) => set.has(t.core);
}

export function locateText(file: ParsedFile, node: { offset: number; text: string }, needle: string): Pos {
  const span = node.text.length * 2 + 40;
  const exact = file.source.indexOf(needle, node.offset);
  if (exact !== -1 && exact < node.offset + span) return file.lines.pos(exact);
  const window = file.source.slice(node.offset, node.offset + span).toLowerCase();
  const index = window.indexOf(needle.toLowerCase());
  return file.lines.pos(index === -1 ? node.offset : node.offset + index);
}
