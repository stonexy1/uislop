import { nextGroup, tokenizeClassString } from "./classes";
import { parseInlineStyle, scanCss } from "./css";
import { addClassTokens, addElement, addText, emptyFacts, INLINE_BLOCK_BASE, type Facts } from "./facts";
import { classifyHandlerString } from "./handlers";
import { collapseWhitespace, COPY_ATTRS, decodeEntities } from "./text";
import type { AttrInfo, ElementNode, LineIndex } from "../types";

const RAW_TEXT_TAGS = ["script", "style", "pre", "code", "textarea", "svg"];
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const IMPLIED_CLOSE: Record<string, string[]> = {
  li: ["li"],
  p: ["p"],
  td: ["td", "th"],
  th: ["td", "th"],
  tr: ["td", "th", "tr"],
  option: ["option"],
  dt: ["dt", "dd"],
  dd: ["dt", "dd"],
};
const TAG_RE = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/y;
const ATTR_RE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function blank(chars: string[], start: number, end: number): void {
  for (let i = start; i < end; i++) if (chars[i] !== "\n") chars[i] = " ";
}

function maskHtml(source: string, lines: LineIndex, facts: Facts): string {
  const work = source.split("");
  for (const match of source.matchAll(/<!--([\s\S]*?)-->/g)) {
    const start = match.index as number;
    facts.comments.push({ value: match[1] as string, start, end: start + match[0].length });
    blank(work, start, start + match[0].length);
  }
  const text = work.join("");
  for (const tag of RAW_TEXT_TAGS) {
    if (!text.includes(`<${tag}`) && !text.toLowerCase().includes(`<${tag}`)) continue;
    const re = new RegExp(`(<${tag}\\b(?:[^>"']|"[^"]*"|'[^']*')*>)([\\s\\S]*?)(</${tag}\\s*>)`, "gi");
    for (const match of text.matchAll(re)) {
      const contentStart = (match.index as number) + (match[1] as string).length;
      const content = match[2] as string;
      if (tag === "style") scanCss(content, contentStart, lines, facts);
      blank(work, contentStart, contentStart + content.length);
    }
  }
  return work.join("");
}

function attributes(attrText: string, attrOffset: number, el: ElementNode, facts: Facts, lines: LineIndex): void {
  for (const match of attrText.matchAll(ATTR_RE)) {
    const name = (match[1] as string).toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    const start = attrOffset + (match.index as number);
    const pos = lines.pos(start);
    const info: AttrInfo = { name, line: pos.line, column: pos.column, kind: value === undefined ? "bool" : "string", value: value ?? null };
    el.attrs.set(name, info);
    if (value === undefined) continue;
    const whole = match[0];
    const nameLength = (match[1] as string).length;
    const valueIndex =
      match[2] !== undefined
        ? whole.indexOf('"', nameLength) + 1
        : match[3] !== undefined
          ? whole.indexOf("'", nameLength) + 1
          : whole.length - value.length;
    const valueOffset = start + valueIndex;
    if (name === "class") {
      addClassTokens(facts, tokenizeClassString(value, valueOffset, lines, "html", nextGroup(), el));
    } else if (name === "style") {
      facts.decls.push(...parseInlineStyle(value, valueOffset, lines, INLINE_BLOCK_BASE + el.id));
    } else if (name.startsWith("on")) {
      info.handler = classifyHandlerString(value);
    } else if (COPY_ATTRS.has(name)) {
      const text = collapseWhitespace(decodeEntities(value));
      if (text) addText(facts, lines, text, valueOffset, "attr", el, name);
    }
  }
}

export function parseHtml(source: string, lines: LineIndex): Facts {
  const facts = emptyFacts();
  const masked = maskHtml(source, lines, facts);
  const stack: ElementNode[] = [];
  let cursor = 0;

  const flushText = (end: number): void => {
    const raw = masked.slice(cursor, end);
    const text = collapseWhitespace(decodeEntities(raw));
    if (text) addText(facts, lines, text, cursor + raw.search(/\S/), "html-text", stack[stack.length - 1] ?? null);
  };

  let i = masked.indexOf("<");
  while (i !== -1) {
    if (masked[i + 1] === "!" || masked[i + 1] === "?") {
      flushText(i);
      const close = masked.indexOf(">", i);
      cursor = close === -1 ? masked.length : close + 1;
      i = masked.indexOf("<", cursor);
      continue;
    }
    TAG_RE.lastIndex = i;
    const match = TAG_RE.exec(masked);
    if (!match) {
      i = masked.indexOf("<", i + 1);
      continue;
    }
    flushText(i);
    const end = i + match[0].length;
    const tag = (match[2] as string).toLowerCase();
    if (match[1]) {
      const index = stack.map((e) => e.tag).lastIndexOf(tag);
      if (index !== -1) {
        for (const open of stack.splice(index)) open.endOffset = end;
      }
    } else {
      const implied = IMPLIED_CLOSE[tag];
      while (implied && stack.length > 0 && implied.includes((stack[stack.length - 1] as ElementNode).tag)) {
        (stack.pop() as ElementNode).endOffset = i;
      }
      const el = addElement(facts, lines, tag, false, i, stack[stack.length - 1] ?? null);
      attributes(match[3] as string, i + 1 + (match[2] as string).length, el, facts, lines);
      if (VOID_TAGS.has(tag) || match[4]) el.endOffset = end;
      else stack.push(el);
    }
    cursor = end;
    i = masked.indexOf("<", cursor);
  }
  flushText(masked.length);
  for (const open of stack) open.endOffset = source.length;
  return facts;
}
