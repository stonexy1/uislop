import { INLINE_BLOCK_BASE } from "../parse/facts";
import type { ClassToken, ElementNode, Rule, RuleContext } from "../types";

const NUMERIC_TEXT_RE = /^[$€£¥]?\s?\d[\d,.]*\s?(%|[kKmMbB]|\+|ms)?\+?$/;
const NUMERIC_MARKER_RE = /[$€£¥%.kKmMbB+]|ms/;
const DYNAMIC_TAGS = new Set(["td", "th", "dd", "output"]);

function isTabularToken(token: ClassToken): boolean {
  if (token.core === "tabular-nums" || token.core === "font-mono" || token.core === "slashed-zero") return true;
  const arbitrary = token.arbitrary ?? "";
  return (
    (token.core.startsWith("[font-variant-numeric:") && arbitrary.includes("tabular-nums")) ||
    (token.core.startsWith("[font-feature-settings:") && arbitrary.includes("tnum"))
  );
}

function hasTabularStyle(ctx: RuleContext, el: ElementNode): boolean {
  if (el.attrs.get("style")?.value?.includes("tabular-nums")) return true;
  return ctx.file.decls.some((d) => d.blockId === INLINE_BLOCK_BASE + el.id && d.value.includes("tabular-nums"));
}

function isTabular(ctx: RuleContext, el: ElementNode): boolean {
  if (ctx.hasClassInChain(el, isTabularToken)) return true;
  return [el, ...ctx.ancestors(el)].some((node) => hasTabularStyle(ctx, node));
}

export function isNumericText(text: string): boolean {
  if (!NUMERIC_TEXT_RE.test(text) || /^\d$/.test(text)) return false;
  return (text.match(/\d/g) ?? []).length >= 2 || NUMERIC_MARKER_RE.test(text);
}

function emphasized(ctx: RuleContext, el: ElementNode): boolean {
  return ctx.classesOf(el).some((t) => /^text-(xl|[2-9]xl)$/.test(t.core) || /^font-(semibold|bold)$/.test(t.core));
}

export const missingTabularNums: Rule = {
  id: "typo-slop/missing-tabular-nums",
  category: "typo-slop",
  weight: 1,
  defaultSeverity: "warn",
  summary: "Numbers, prices and stats without tabular-nums",
  appliesTo: ["tsx", "jsx", "html"],
  fixHint:
    'Add tabular-nums (class "tabular-nums", optionally with font-mono) to numeric text, counters, prices and table cells so digits align.',
  check(ctx) {
    for (const el of ctx.file.allElements) {
      const direct = el.texts.map((t) => t.text).join(" ").trim();
      const staticHit = el.texts.length > 0 && isNumericText(direct);
      const dynamicHit = !staticHit && el.dynamicNumeric && (DYNAMIC_TAGS.has(el.tag) || emphasized(ctx, el));
      if (!staticHit && !dynamicHit) continue;
      if (isTabular(ctx, el)) continue;
      if (staticHit) {
        const text = el.texts[0] as { line: number; column: number };
        ctx.report({ line: text.line, column: text.column, anchorLine: el.line, message: `Number "${direct}" without tabular-nums` });
      } else if (el.dynamicNumeric) {
        const { line, column, text } = el.dynamicNumeric;
        ctx.report({ line, column, anchorLine: el.line, severity: "info", message: `Number "{${text}}" without tabular-nums` });
      }
    }
  },
};

const MAX_W_RE = /^max-w-(xs|sm|md|lg|xl|2xl|3xl|4xl|prose|screen-sm|screen-md)$/;
const FRACTION_W = new Set(["1/4", "1/3", "2/5", "1/2", "3/5", "2/3"]);

function constrains(token: ClassToken): boolean {
  const { core, utility } = token;
  if (core.startsWith("prose") && core !== "prose-none") return true;
  if (MAX_W_RE.test(core)) return true;
  const arbitrary = /^max-w-\[(\d*\.?\d+)(ch|rem|em|px)\]$/.exec(core);
  if (arbitrary) {
    const n = Number(arbitrary[1]);
    if (arbitrary[2] === "ch") return n <= 80;
    return arbitrary[2] === "px" ? n <= 896 : n <= 56;
  }
  if (utility.startsWith("w-") && FRACTION_W.has(utility.slice(2))) return true;
  const fixed = /^w-(\d+(?:\.\d+)?)$/.exec(utility);
  return fixed !== null && Number(fixed[1]) <= 160;
}

function hasMaxWidthStyle(ctx: RuleContext, el: ElementNode): boolean {
  if (/max-width/i.test(el.attrs.get("style")?.value ?? "")) return true;
  return ctx.file.decls.some((d) => d.blockId === INLINE_BLOCK_BASE + el.id && d.prop === "max-width");
}

export const unconstrainedParagraph: Rule = {
  id: "typo-slop/unconstrained-paragraph",
  category: "typo-slop",
  weight: 1,
  defaultSeverity: "warn",
  summary: "Long paragraphs with no max width",
  appliesTo: ["tsx", "jsx", "html"],
  defaultOptions: { minChars: 160 },
  fixHint: "Cap the line length: add max-w-prose (or max-w-2xl) to the paragraph or its wrapper.",
  check(ctx) {
    if (!ctx.file.isTailwindish) return;
    for (const el of ctx.file.allElements) {
      if (el.tag !== "p" && el.tag !== "blockquote") continue;
      const length = ctx.textOf(el).length;
      if (length < Number(ctx.options.minChars)) continue;
      if (ctx.hasClassInChain(el, constrains)) continue;
      if ([el, ...ctx.ancestors(el)].some((node) => hasMaxWidthStyle(ctx, node))) continue;
      ctx.report({ line: el.line, column: el.column, anchorLine: el.line, message: `Long paragraph (${length} chars) with no width constraint` });
    }
  },
};

export const typoSlopRules: Rule[] = [missingTabularNums, unconstrainedParagraph];
