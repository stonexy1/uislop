import { extractColors, inAiRange, inPartnerRange, isPureBlack, isPureWhite, parseColor, parseShadowList, splitTopLevel, toHsl } from "../parse/color";
import { parseColorUtility } from "../parse/classes";
import { AI_HUES, GLOW_HUES, PARTNER_HUES } from "./data/palette";
import { anchorOf, coreIs, groupTokens, hasToken } from "./helpers";
import type { ClassToken, CssDecl, Rule, RuleContext } from "../types";

const GRADIENT_FN_RE = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/i;

function classifyStop(token: ClassToken): "ai" | "partner" | "other" | null {
  const color = parseColorUtility(token);
  if (!color || !["from", "via", "to"].includes(color.prefix) || color.special) return null;
  if (color.hue) {
    if (AI_HUES.has(color.hue)) return "ai";
    if (PARTNER_HUES.has(color.hue)) return "partner";
    return "other";
  }
  if (color.color) {
    if (color.color.a === 0) return null;
    if (inAiRange(color.color)) return "ai";
    if (inPartnerRange(color.color)) return "partner";
    return "other";
  }
  return null;
}

function gradientSeverity(ai: number, partner: number, total: number): "error" | "warn" | null {
  if (total < 2) return null;
  if (ai >= 2) return "error";
  if (ai >= 1 && partner >= 1) return "warn";
  return null;
}

export const aiGradient: Rule = {
  id: "color-slop/ai-gradient",
  category: "color-slop",
  weight: 3,
  defaultSeverity: "warn",
  summary: "Purple, indigo or pink gradients (the default AI palette)",
  appliesTo: ["tsx", "jsx", "css", "html"],
  fixHint:
    "Replace the gradient with a flat surface (bg-zinc-50 / dark:bg-zinc-950) and ONE accent color (e.g. bg-emerald-600). If a gradient is essential, use two adjacent shades of a single hue, not a rainbow.",
  check(ctx: RuleContext) {
    for (const group of groupTokens(ctx.file.classTokens)) {
      const stops = group.map((t) => ({ token: t, kind: classifyStop(t) })).filter((s) => s.kind !== null);
      const ai = stops.filter((s) => s.kind === "ai").length;
      const partner = stops.filter((s) => s.kind === "partner").length;
      const severity = gradientSeverity(ai, partner, stops.length);
      if (!severity) continue;
      const first = (stops[0] as { token: ClassToken }).token;
      const list = stops.map((s) => s.token.raw).join(" ");
      const isText = hasToken(group, coreIs("bg-clip-text")) && hasToken(group, coreIs("text-transparent"));
      ctx.report({
        line: first.line,
        column: first.column,
        severity: severity === "error" ? "error" : undefined,
        anchorLine: anchorOf(first),
        message: isText ? `Gradient text (${list}) is the default AI headline` : `Gradient ${list} is the default AI palette`,
      });
    }
    for (const decl of ctx.file.decls) {
      if (!GRADIENT_FN_RE.test(decl.value)) continue;
      const colors = extractColors(decl.value.slice(decl.value.search(GRADIENT_FN_RE)));
      const ai = colors.filter((c) => inAiRange(c.color)).length;
      const partner = colors.filter((c) => !inAiRange(c.color) && inPartnerRange(c.color)).length;
      const severity = gradientSeverity(ai, partner, colors.length);
      if (!severity) continue;
      ctx.report({
        line: decl.line,
        column: decl.column,
        severity: severity === "error" ? "error" : undefined,
        message: `Gradient ${colors.map((c) => c.text).join(" ")} is the default AI palette`,
      });
    }
  },
};

function shadowIsNeon(value: string): boolean {
  return parseShadowList(value).some((shadow) => {
    if (!shadow.color) return false;
    const { s } = toHsl(shadow.color);
    if (s < 0.5 || shadow.color.a < 0.25) return false;
    return inAiRange(shadow.color) || (shadow.x === 0 && shadow.y === 0 && shadow.blur >= 12);
  });
}

function neonShadowToken(token: ClassToken): boolean {
  if (!/^(drop-)?shadow-/.test(token.core)) return false;
  const color = parseColorUtility(token);
  if (color && (color.prefix === "shadow" || color.prefix === "drop-shadow") && color.hue && color.shade !== undefined) {
    if (AI_HUES.has(color.hue)) return true;
    const opacity = token.modifier !== undefined && /^\d+$/.test(token.modifier) ? Number(token.modifier) : null;
    return GLOW_HUES.has(color.hue) && color.shade >= 400 && opacity !== null && opacity >= 40;
  }
  if (token.arbitrary !== undefined && !color) return shadowIsNeon(token.arbitrary);
  return false;
}

function cssShadowValue(decl: CssDecl): string | null {
  if (decl.prop === "box-shadow" || decl.prop === "text-shadow") return decl.value;
  if (decl.prop === "filter") {
    const match = /drop-shadow\(((?:[^()]|\([^()]*\))*)\)/.exec(decl.value);
    return match ? (match[1] as string) : null;
  }
  return null;
}

export const neonShadow: Rule = {
  id: "color-slop/neon-shadow",
  category: "color-slop",
  weight: 2,
  defaultSeverity: "warn",
  summary: "Colored glow shadows (shadow-purple-500/50 and friends)",
  appliesTo: ["tsx", "jsx", "css", "html"],
  fixHint: "Use a neutral shadow (shadow-sm, or shadow-zinc-900/10) or none; separate surfaces with a 1px border-zinc-200 instead of a glow.",
  check(ctx) {
    for (const token of ctx.file.classTokens) {
      if (!neonShadowToken(token)) continue;
      ctx.report({ line: token.line, column: token.column, anchorLine: anchorOf(token), message: `Neon tinted shadow ${token.raw} (colored glow)` });
    }
    for (const decl of ctx.file.decls) {
      const value = cssShadowValue(decl);
      if (value === null || !shadowIsNeon(value)) continue;
      ctx.report({ line: decl.line, column: decl.column, message: `Neon tinted shadow ${decl.prop}: ${decl.value} (colored glow)` });
    }
  },
};

const BLACK_ARBITRARY = new Set(["#000", "#000000", "black", "rgb(0,0,0)", "rgb(0 0 0)"]);
const WHITE_ARBITRARY = new Set(["#fff", "#ffffff", "white", "rgb(255,255,255)", "rgb(255 255 255)"]);
const BW_PREFIX_RE = /^(text|bg|border)-/;

function isDarkVariant(token: ClassToken): boolean {
  return token.variants.includes("dark");
}

function isPureToken(token: ClassToken, special: string, arbitrary: Set<string>): boolean {
  if (isDarkVariant(token) || token.modifier !== undefined || !BW_PREFIX_RE.test(token.core)) return false;
  if (token.core === `${token.core.split("-")[0]}-${special}`) return true;
  return token.arbitrary !== undefined && /^(text|bg|border)-\[/.test(token.core) && arbitrary.has(token.arbitrary.replace(/\s+/g, "").toLowerCase());
}

const COLOR_PROPS = new Set(["color", "background", "background-color", "border-color", "fill", "stroke"]);

function cssPure(value: string, test: (c: NonNullable<ReturnType<typeof parseColor>>) => boolean): boolean {
  return splitTopLevel(value, " ").some((part) => {
    const color = parseColor(part);
    return color !== null && test(color);
  });
}

export const pureBlackWhite: Rule = {
  id: "color-slop/pure-black-white",
  category: "color-slop",
  weight: 1.5,
  defaultSeverity: "warn",
  summary: "Pure #000 text or surfaces instead of a tuned neutral",
  appliesTo: ["tsx", "jsx", "css", "html"],
  fixHint:
    "Use zinc/neutral instead: text-zinc-900 or text-zinc-950 for text, bg-zinc-950 for dark surfaces, bg-white or bg-zinc-50 for light ones.",
  check(ctx) {
    for (const group of groupTokens(ctx.file.classTokens)) {
      if (hasToken(group, (t) => t.core.startsWith("opacity-"))) continue;
      if (hasToken(group, coreIs("inset-0")) && hasToken(group, coreIs("fixed", "absolute"))) continue;
      const black = group.find((t) => isPureToken(t, "black", BLACK_ARBITRARY));
      if (!black) continue;
      const stark = group.some((t) => isPureToken(t, "white", WHITE_ARBITRARY));
      ctx.report({
        line: black.line,
        column: black.column,
        anchorLine: anchorOf(black),
        message: stark ? `Stark pure black/white pairing (${black.raw})` : `Pure black (${black.raw}) instead of a nuanced neutral`,
      });
    }
    const blocks = new Map<number, CssDecl[]>();
    for (const decl of ctx.file.decls) {
      if (!COLOR_PROPS.has(decl.prop)) continue;
      if (decl.atRule?.includes("prefers-color-scheme: dark") || /\.dark\b|\[data-theme=["']?dark/.test(decl.selector)) continue;
      blocks.set(decl.blockId, [...(blocks.get(decl.blockId) ?? []), decl]);
    }
    for (const decls of blocks.values()) {
      const black = decls.find((d) => cssPure(d.value, isPureBlack));
      if (!black) continue;
      const stark = decls.some((d) => cssPure(d.value, isPureWhite));
      const token = `${black.prop}: ${black.value}`;
      ctx.report({
        line: black.line,
        column: black.column,
        message: stark ? `Stark pure black/white pairing (${token})` : `Pure black (${token}) instead of a nuanced neutral`,
      });
    }
  },
};

const ACCENT_PREFIXES = new Set(["bg", "text", "border", "ring", "fill", "stroke", "outline", "accent"]);

export const aiAccentPalette: Rule = {
  id: "color-slop/ai-accent-palette",
  category: "color-slop",
  weight: 1,
  defaultSeverity: "info",
  summary: "File leans on indigo, violet or purple accents throughout",
  appliesTo: ["tsx", "jsx", "css", "html"],
  defaultOptions: { minUses: 5 },
  fixHint: "Pick one non-default accent (emerald, amber, sky, or a custom brand color) and use it sparingly on primary actions; keep everything else zinc.",
  check(ctx) {
    const uses = ctx.file.classTokens.filter((t) => {
      const color = parseColorUtility(t);
      const prefix = color?.prefix.split("-")[0] ?? "";
      return (
        color?.hue !== undefined &&
        AI_HUES.has(color.hue) &&
        ACCENT_PREFIXES.has(prefix) &&
        color.shade !== undefined &&
        color.shade >= 400 &&
        color.shade <= 700
      );
    });
    if (uses.length < Number(ctx.options.minUses)) return;
    const first = uses[0] as ClassToken;
    const hues = [...new Set(uses.map((t) => parseColorUtility(t)?.hue))].join("/");
    ctx.report({
      line: first.line,
      column: first.column,
      anchorLine: anchorOf(first),
      message: `Leans on the ${hues} accent family (${uses.length} uses): the default AI-template palette`,
    });
  },
};

export const colorSlopRules: Rule[] = [aiGradient, neonShadow, pureBlackWhite, aiAccentPalette];
