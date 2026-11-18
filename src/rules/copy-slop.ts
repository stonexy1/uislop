import { normalizeForPhrases } from "../parse/text";
import { BUZZWORD_RE, CLICHE_RE, PLACEHOLDER_EMAILS, PLACEHOLDERS, type PhraseSet } from "./data/phrases";
import { locateText } from "./helpers";
import type { Rule, RuleContext, TextNode } from "../types";

interface PhraseHit {
  text: string;
  start: number;
  end: number;
}

const normalizedByFile = new WeakMap<TextNode[], string[]>();

function normalizedTexts(texts: TextNode[]): string[] {
  let list = normalizedByFile.get(texts);
  if (!list) {
    list = texts.map((node) => normalizeForPhrases(node.text));
    normalizedByFile.set(texts, list);
  }
  return list;
}

function phraseHits(text: string, re: RegExp): PhraseHit[] {
  const out: PhraseHit[] = [];
  re.lastIndex = 0;
  for (let match = re.exec(text); match; match = re.exec(text)) {
    out.push({ text: match[0], start: match.index, end: match.index + match[0].length });
    re.lastIndex = match.index + 1;
  }
  return out;
}

function hits(text: string, set: PhraseSet): PhraseHit[] {
  const out: PhraseHit[] = [];
  if (!set.any.test(text)) return out;
  for (const re of set.each) {
    re.lastIndex = 0;
    for (let match = re.exec(text); match; match = re.exec(text)) {
      out.push({ text: match[0], start: match.index, end: match.index + match[0].length });
      if (match[0].length === 0) re.lastIndex++;
    }
  }
  return out;
}

function reportAt(ctx: RuleContext, node: TextNode, needle: string, message: string): void {
  const firstWord = needle.split(/[\s-]+/)[0] ?? needle;
  const pos = locateText(ctx.file, node, firstWord);
  ctx.report({ line: pos.line, column: pos.column, anchorLine: node.element?.line ?? node.line, message });
}

export const clichePhrase: Rule = {
  id: "copy-slop/cliche-phrase",
  category: "copy-slop",
  weight: 2,
  defaultSeverity: "warn",
  summary: "Stock LLM marketing phrases",
  appliesTo: ["tsx", "jsx", "css", "html"],
  fixHint:
    'Say the concrete thing: what the product does, for whom, with what result (e.g. "Track deploys and roll back in one click"). Drop the superlative.',
  check(ctx) {
    const normalized = normalizedTexts(ctx.file.texts);
    ctx.file.texts.forEach((node, i) => {
      const seen = new Set<string>();
      for (const hit of phraseHits(normalized[i] as string, CLICHE_RE)) {
        if (seen.has(hit.text)) continue;
        seen.add(hit.text);
        reportAt(ctx, node, hit.text, `LLM cliché "${hit.text}"`);
      }
    });
  },
};

export const placeholderContent: Rule = {
  id: "copy-slop/placeholder-content",
  category: "copy-slop",
  weight: 2,
  defaultSeverity: "warn",
  summary: "Template placeholder names, lorem ipsum, fake addresses",
  appliesTo: ["tsx", "jsx", "css", "html"],
  fixHint: "Replace with real, specific content or pull it from data; use plausible, varied names and the product's actual details.",
  check(ctx) {
    for (const node of ctx.file.texts) {
      const found = hits(node.text, PLACEHOLDERS);
      if (!(node.origin === "attr" && node.attrName === "placeholder")) {
        found.push(...hits(node.text, PLACEHOLDER_EMAILS));
      }
      for (const hit of found) reportAt(ctx, node, hit.text, `Placeholder content "${hit.text}"`);
    }
  },
};

export const buzzwordDensity: Rule = {
  id: "copy-slop/buzzword-density",
  category: "copy-slop",
  weight: 1,
  defaultSeverity: "info",
  summary: "Two or more buzzwords stacked in one text",
  appliesTo: ["tsx", "jsx", "css", "html"],
  defaultOptions: { minDistinct: 2 },
  fixHint: "Cut adjectives; state one specific fact per sentence.",
  check(ctx) {
    const normalized = normalizedTexts(ctx.file.texts);
    ctx.file.texts.forEach((node, i) => {
      const text = normalized[i] as string;
      const strong = phraseHits(text, CLICHE_RE);
      const weak = phraseHits(text, BUZZWORD_RE).filter((w) => !strong.some((s) => w.start < s.end && s.start < w.end));
      const words = [...new Set([...strong, ...weak].sort((a, b) => a.start - b.start).map((h) => h.text))];
      if (words.length < Number(ctx.options.minDistinct)) return;
      reportAt(ctx, node, words[0] as string, `Buzzword stacking ("${words.join(", ")}")`);
    });
  },
};

export const copySlopRules: Rule[] = [clichePhrase, placeholderContent, buzzwordDensity];
