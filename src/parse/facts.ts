import type { RawComment } from "./directives";
import type { ClassToken, CssDecl, ElementNode, LineIndex, ParsedFile, TextNode } from "../types";

export const INLINE_BLOCK_BASE = 1_000_000;

export interface Facts {
  parseMode: ParsedFile["parseMode"];
  warnings: string[];
  units: number;
  classTokens: ClassToken[];
  texts: TextNode[];
  elements: ElementNode[];
  allElements: ElementNode[];
  decls: CssDecl[];
  constArrays: Map<string, number>;
  comments: RawComment[];
}

export function emptyFacts(): Facts {
  return {
    parseMode: "ok",
    warnings: [],
    units: 0,
    classTokens: [],
    texts: [],
    elements: [],
    allElements: [],
    decls: [],
    constArrays: new Map(),
    comments: [],
  };
}

export function addElement(
  facts: Facts,
  lines: LineIndex,
  tag: string,
  isComponent: boolean,
  offset: number,
  parent: ElementNode | null,
): ElementNode {
  const pos = lines.pos(offset);
  const element: ElementNode = {
    id: facts.allElements.length,
    tag,
    isComponent,
    line: pos.line,
    column: pos.column,
    offset,
    endOffset: offset,
    depth: parent ? parent.depth + 1 : 0,
    parent,
    children: [],
    attrs: new Map(),
    classTokens: [],
    texts: [],
    hasDynamicChild: false,
  };
  if (parent) parent.children.push(element);
  else facts.elements.push(element);
  facts.allElements.push(element);
  facts.units++;
  return element;
}

export function addText(
  facts: Facts,
  lines: LineIndex,
  text: string,
  offset: number,
  origin: TextNode["origin"],
  element: ElementNode | null,
  attrName?: string,
): void {
  const pos = lines.pos(offset);
  const node: TextNode = { text, line: pos.line, column: pos.column, offset, origin, element };
  if (attrName) node.attrName = attrName;
  facts.texts.push(node);
  if (element && (origin === "jsx-text" || origin === "jsx-expr" || origin === "html-text")) element.texts.push(node);
}

export function addClassTokens(facts: Facts, tokens: ClassToken[]): void {
  for (const token of tokens) {
    facts.classTokens.push(token);
    token.owner?.classTokens.push(token);
  }
}
