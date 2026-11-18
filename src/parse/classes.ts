import { SHADES, TAILWIND_HUES } from "../rules/data/palette";
import { parseColor, type Rgba } from "./color";
import type { ClassToken, ElementNode, LineIndex } from "../types";

export const UTILITY_PREFIX_RE =
  /^(?:[a-z0-9\[\]():@&>*_-]+:)*[!-]?(bg|text|border|p[xytblrse]?|m[xytblrse]?|w|h|size|min-[wh]|max-[wh]|flex|grid|gap|space-[xy]|rounded|shadow|ring|from|via|to|font|leading|tracking|items|justify|inline|block|hidden|absolute|relative|fixed|sticky|z|opacity|transition|duration|ease|cursor|overflow|sr-only|truncate|underline)(?:-|$|\/)/;

export type ParsedToken = Pick<ClassToken, "raw" | "variants" | "important" | "negative" | "utility" | "core" | "modifier" | "arbitrary">;

function splitTopLevel(raw: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth = Math.max(0, depth - 1);
    else if (c === separator && depth === 0) {
      parts.push(raw.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(raw.slice(start));
  return parts;
}

function lastTopLevelSlash(text: string): number {
  let depth = 0;
  let found = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth = Math.max(0, depth - 1);
    else if (c === "/" && depth === 0) found = i;
  }
  return found;
}

function firstBracketContent(text: string): string | undefined {
  const start = text.search(/[\[(]/);
  if (start === -1) return undefined;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") {
      depth--;
      if (depth === 0) return text.slice(start + 1, i).replace(/_/g, " ");
    }
  }
  return undefined;
}

const tokenCache = new Map<string, ParsedToken>();

export function parseToken(raw: string): ParsedToken {
  let token = tokenCache.get(raw);
  if (!token) {
    token = parseRawToken(raw);
    tokenCache.set(raw, token);
  }
  return token;
}

function parseRawToken(raw: string): ParsedToken {
  const segments = splitTopLevel(raw, ":");
  let utility = segments.pop() ?? "";
  const variants = segments;
  let important = false;
  if (utility.startsWith("!")) {
    important = true;
    utility = utility.slice(1);
  } else if (utility.endsWith("!")) {
    important = true;
    utility = utility.slice(0, -1);
  }
  let negative = false;
  if (utility.startsWith("-")) {
    negative = true;
    utility = utility.slice(1);
  }
  const slash = lastTopLevelSlash(utility);
  const core = slash === -1 ? utility : utility.slice(0, slash);
  const modifier = slash === -1 ? undefined : utility.slice(slash + 1);
  const arbitrary = firstBracketContent(core);
  const token: ParsedToken = { raw, variants, important, negative, utility, core };
  if (modifier !== undefined) token.modifier = modifier;
  if (arbitrary !== undefined) token.arbitrary = arbitrary;
  return token;
}

let groupCounter = 0;

export function nextGroup(): number {
  return ++groupCounter;
}

export function tokenizeClassString(
  text: string,
  baseOffset: number,
  lines: LineIndex,
  origin: ClassToken["origin"],
  group: number,
  owner?: ElementNode,
): ClassToken[] {
  const tokens: ClassToken[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    const offset = baseOffset + (match.index as number);
    const pos = lines.pos(offset);
    const token: ClassToken = { ...parseToken(match[0]), line: pos.line, column: pos.column, offset, origin, group };
    if (owner) token.owner = owner;
    tokens.push(token);
  }
  return tokens;
}

export interface ColorUtility {
  prefix: string;
  hue?: string;
  shade?: number;
  special?: string;
  color?: Rgba;
}

const COLOR_UTILITY_RE =
  /^(bg|text|border(?:-[xytblrse])?|from|via|to|drop-shadow|shadow|ring-offset|ring|fill|stroke|outline|divide|accent|caret|decoration|placeholder)-(.+)$/;
const SPECIAL_COLORS = new Set(["black", "white", "transparent", "current", "inherit"]);

const colorUtilityCache = new Map<string, ColorUtility | null>();

export function parseColorUtility(token: Pick<ClassToken, "core">): ColorUtility | null {
  const cached = colorUtilityCache.get(token.core);
  if (cached !== undefined) return cached;
  const result = parseColorCore(token.core);
  colorUtilityCache.set(token.core, result);
  return result;
}

function parseColorCore(core: string): ColorUtility | null {
  const match = COLOR_UTILITY_RE.exec(core);
  if (!match) return null;
  const prefix = match[1] as string;
  const rest = match[2] as string;
  if (SPECIAL_COLORS.has(rest)) return { prefix, special: rest };
  const hueShade = /^([a-z]+)-(\d+)$/.exec(rest);
  if (hueShade) {
    const hue = hueShade[1] as string;
    const shade = Number(hueShade[2]);
    return TAILWIND_HUES.has(hue) && SHADES.has(shade) ? { prefix, hue, shade } : null;
  }
  if (/^[\[(].*[\])]$/.test(rest)) {
    const content = rest.slice(1, -1).replace(/_/g, " ").replace(/^color:/, "");
    const color = parseColor(content);
    return color ? { prefix, color } : null;
  }
  return null;
}
