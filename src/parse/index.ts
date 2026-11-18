import { UTILITY_PREFIX_RE } from "./classes";
import { parseCssFile } from "./css";
import { parseDirectives } from "./directives";
import { parseHtml } from "./html";
import { createLineIndex } from "./lines";
import { parseTsx } from "./tsx";
import type { Facts } from "./facts";
import type { FileEntry, ParsedFile } from "../types";

export interface ParseOptions {
  classFunctions: string[];
  isKnownId(id: string): boolean;
}

export function parseFile(entry: FileEntry, source: string, options: ParseOptions): ParsedFile {
  const lines = createLineIndex(source);
  let facts: Facts;
  if (entry.kind === "css") facts = parseCssFile(source, lines);
  else if (entry.kind === "html") facts = parseHtml(source, lines);
  else facts = parseTsx(source, lines, entry.kind, options.classFunctions);
  const directives = parseDirectives(facts.comments, source, lines, {
    isKnownId: options.isKnownId,
    warn: (message) => facts.warnings.push(message),
  });
  const utilityCount = facts.classTokens.filter((t) => UTILITY_PREFIX_RE.test(t.raw)).length;
  return {
    entry,
    source,
    kind: entry.kind,
    lines,
    parseMode: facts.parseMode,
    warnings: facts.warnings,
    units: facts.units,
    classTokens: facts.classTokens,
    texts: facts.texts,
    elements: facts.elements,
    allElements: facts.allElements,
    decls: facts.decls,
    constArrays: facts.constArrays,
    isTailwindish: utilityCount >= 3,
    directives,
  };
}
