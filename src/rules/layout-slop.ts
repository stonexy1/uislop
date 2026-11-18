import { parseShadowList } from "../parse/color";
import { emojiRuns } from "./data/emoji";
import { anchorOf, groupTokens } from "./helpers";
import type { ClassToken, ElementNode, ParsedFile, Rule, RuleContext } from "../types";

const SIG_DEPTH = 4;
const ICON_COMPONENT_RE = /Icon$|^(Fa|Bs|Lu|Hi|Ri|Md|Fi|Io|Tb)[A-Z]/;
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "CardTitle", "strong"]);
const PARAGRAPH_TAGS = new Set(["p", "CardDescription", "CardContent"]);
const CARD_COMPONENT_RE = /(Card|Feature|Benefit|Pricing|Testimonial|Step)/;
const CARD_PROP_NAMES = ["title", "description", "heading", "text", "icon"];

function isLoneEmoji(el: ElementNode): boolean {
  if (el.children.length > 0 || el.hasDynamicChild) return false;
  const text = el.texts.map((t) => t.text).join(" ").trim();
  if (!text) return false;
  const runs = emojiRuns(text);
  return runs.length === 1 && (runs[0] as { text: string }).text === text;
}

function isIconLeaf(el: ElementNode): boolean {
  if (isLoneEmoji(el)) return true;
  if (el.children.length > 0 || el.texts.length > 0) return false;
  if (el.isComponent) return ICON_COMPONENT_RE.test(el.tag);
  return el.tag === "svg" || el.tag === "img" || el.tag === "i";
}

function signature(el: ElementNode, depth = 0): string {
  if (isIconLeaf(el)) return "I";
  const tag = el.isComponent ? `C:${el.tag}` : el.tag.toLowerCase();
  if (depth >= SIG_DEPTH) return `${tag}(…)`;
  const parts = el.children.map((child) => signature(child, depth + 1));
  if (el.texts.length > 0) parts.push("t");
  if (el.hasDynamicChild) parts.push("e");
  return `${tag}(${parts.join(",")})`;
}

function nodeCount(sig: string): number {
  return (sig.match(/[A-Za-z0-9:.]+\(|I/g) ?? []).length;
}

function subtreeHas(el: ElementNode, tags: Set<string>): boolean {
  return el.children.some((child) => tags.has(child.tag) || subtreeHas(child, tags));
}

function containsIcon(el: ElementNode): boolean {
  return isIconLeaf(el) || el.children.some(containsIcon);
}

interface CardGroup {
  parent: ElementNode;
  cards: ElementNode[];
  count: number;
}

function layoutColumns(ctx: RuleContext, el: ElementNode): number | null {
  const classes = ctx.classesOf(el);
  const cores = new Set(classes.map((t) => t.core));
  const cols = classes
    .map((t) => /^grid-cols-([3-6])$/.exec(t.core))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  if (cores.has("grid") && cols.length > 0) return Math.max(...cols);
  if (cores.has("flex") && classes.some((t) => /^gap-/.test(t.core))) return 0;
  return null;
}

function isCardLike(el: ElementNode, sig: string): boolean {
  return nodeCount(sig) >= 4 && subtreeHas(el, HEADING_TAGS) && subtreeHas(el, PARAGRAPH_TAGS);
}

function isCardComponent(el: ElementNode): boolean {
  if (!el.isComponent || !CARD_COMPONENT_RE.test(el.tag)) return false;
  return CARD_PROP_NAMES.filter((name) => el.attrs.get(name)?.value).length >= 2;
}

const groupCache = new WeakMap<ParsedFile, Map<number, CardGroup[]>>();

function cardGroups(ctx: RuleContext, minSiblings: number): CardGroup[] {
  const byMin = groupCache.get(ctx.file) ?? new Map<number, CardGroup[]>();
  groupCache.set(ctx.file, byMin);
  const cached = byMin.get(minSiblings);
  if (cached) return cached;
  const groups = findCardGroups(ctx, minSiblings);
  byMin.set(minSiblings, groups);
  return groups;
}

function findCardGroups(ctx: RuleContext, minSiblings: number): CardGroup[] {
  const groups: CardGroup[] = [];
  for (const parent of ctx.file.allElements) {
    if (parent.children.length === 0 || layoutColumns(ctx, parent) === null) continue;
    const sigs = parent.children.map((child) => signature(child));
    let start = 0;
    while (start < parent.children.length) {
      let end = start + 1;
      while (end < parent.children.length && sigs[end] === sigs[start]) end++;
      const run = parent.children.slice(start, end);
      const first = run[0] as ElementNode;
      const count = run.length === 1 && first.repeated?.count ? first.repeated.count : run.length;
      const qualifies = isCardLike(first, sigs[start] as string) || run.every(isCardComponent);
      if (count >= minSiblings && qualifies && (run.length > 1 || first.repeated)) {
        groups.push({ parent, cards: run, count });
      }
      start = end;
    }
  }
  return groups;
}

function hasIconTile(ctx: RuleContext, card: ElementNode): boolean {
  if (card.isComponent) return card.attrs.has("icon");
  const tile = card.children[0];
  if (!tile) return false;
  const cores = ctx.classesOf(tile).map((t) => t.core);
  const shaped =
    cores.some((c) => c.startsWith("rounded")) &&
    cores.some((c) => c.startsWith("bg-")) &&
    cores.some((c) => /^(w|h|size)-/.test(c));
  if (!shaped) return false;
  const iconSlot = tile.children.length === 0 && tile.texts.length === 0 && tile.hasDynamicChild;
  const iconComponent = tile.children.some((c) => c.isComponent && c.children.length === 0 && c.texts.length === 0);
  return containsIcon(tile) || iconSlot || iconComponent;
}

function columnsLabel(ctx: RuleContext, group: CardGroup): string {
  const cols = layoutColumns(ctx, group.parent);
  return String(cols && cols > 0 ? cols : group.count);
}

export const iconCardGrid: Rule = {
  id: "layout-slop/icon-card-grid",
  category: "layout-slop",
  weight: 3,
  defaultSeverity: "error",
  summary: "Grid of identical cards with colored icon tiles",
  appliesTo: ["tsx", "jsx", "html"],
  defaultOptions: { minSiblings: 3 },
  fixHint:
    "Break the symmetry: vary card size and span, drop the colored icon squares (use a plain 16-20px icon inline with the heading or none), or turn the grid into a list/table of real features with specifics.",
  check(ctx) {
    for (const group of cardGroups(ctx, Number(ctx.options.minSiblings))) {
      if (!group.cards.every((card) => hasIconTile(ctx, card))) continue;
      ctx.report({
        line: group.parent.line,
        column: group.parent.column,
        anchorLine: group.parent.line,
        message: `${group.count} identical feature cards (icon tile, heading, paragraph) in a ${columnsLabel(ctx, group)}-column grid`,
      });
    }
  },
};

export const identicalCardGrid: Rule = {
  id: "layout-slop/identical-card-grid",
  category: "layout-slop",
  weight: 2,
  defaultSeverity: "warn",
  summary: "Grid of identical heading-plus-paragraph cards",
  appliesTo: ["tsx", "jsx", "html"],
  defaultOptions: { minSiblings: 3 },
  fixHint: "Vary the content structure: one featured card spanning 2 columns, differing lengths, or replace with a definition list.",
  check(ctx) {
    for (const group of cardGroups(ctx, Number(ctx.options.minSiblings))) {
      if (group.cards.every((card) => hasIconTile(ctx, card))) continue;
      ctx.report({
        line: group.parent.line,
        column: group.parent.column,
        anchorLine: group.parent.line,
        message: `${group.count} identical cards (heading + paragraph) in a grid`,
      });
    }
  },
};

const HERO_TAGS = new Set(["section", "header", "div", "main"]);
const HERO_DEPTH = 6;
const CTA_PRIMARY_RE = /^(get started|start (for )?free|start (your )?free trial|try (it )?(for )?free|sign up( free)?|join (the )?waitlist|book a demo|request (a )?demo)/i;
const CTA_SECONDARY_RE = /^(learn more|see (how it works|demo|pricing)|watch (the )?demo|view (docs|demo)|read (the )?docs|contact sales|talk to sales)/i;
const CTA_TAGS = new Set(["button", "a", "Button", "Link"]);

function descendants(el: ElementNode, maxDepth: number): ElementNode[] {
  const out: ElementNode[] = [];
  const visit = (node: ElementNode, depth: number) => {
    if (depth > maxDepth) return;
    for (const child of node.children) {
      out.push(child);
      visit(child, depth + 1);
    }
  };
  visit(el, 1);
  return out;
}

interface HeroSignals {
  full: boolean;
  partial: boolean;
  ctas: string[];
}

function heroSignals(ctx: RuleContext, el: ElementNode): HeroSignals {
  const none = { full: false, partial: false, ctas: [] };
  const has = (node: ElementNode, pred: (core: string) => boolean) => ctx.classesOf(node).some((t) => pred(t.core));
  const wrappers = [el, ...el.children];
  const centered =
    wrappers.some((n) => has(n, (c) => c === "text-center")) &&
    wrappers.some((n) => has(n, (c) => c === "items-center" || c === "mx-auto" || c === "justify-center"));
  if (!centered) return none;
  const inside = descendants(el, HERO_DEPTH);
  const h1Index = inside.findIndex((n) => n.tag === "h1" && has(n, (c) => /^text-([4-9]xl)$/.test(c)));
  if (h1Index === -1) return none;
  const pill = inside.slice(0, h1Index).some(
    (n) =>
      has(n, (c) => c === "rounded-full") &&
      has(n, (c) => c.startsWith("bg-")) &&
      has(n, (c) => c.startsWith("px-")) &&
      has(n, (c) => c === "text-xs" || c === "text-sm") &&
      ctx.textOf(n).length > 0,
  );
  const ctaTexts = inside.filter((n) => CTA_TAGS.has(n.tag)).map((n) => ctx.textOf(n));
  const primary = ctaTexts.find((t) => CTA_PRIMARY_RE.test(t));
  const secondary = ctaTexts.find((t) => CTA_SECONDARY_RE.test(t));
  const ctas = [primary, secondary].filter((t): t is string => t !== undefined);
  return {
    full: pill && ctas.length > 0,
    partial: primary !== undefined && secondary !== undefined,
    ctas,
  };
}

function isHeroCandidate(el: ElementNode): boolean {
  return el.isComponent ? /^Hero/.test(el.tag) : HERO_TAGS.has(el.tag);
}

export const templateHero: Rule = {
  id: "layout-slop/template-hero",
  category: "layout-slop",
  weight: 3,
  defaultSeverity: "error",
  summary: "Centered hero with pill badge, giant headline and two stock CTAs",
  appliesTo: ["tsx", "jsx", "html"],
  fixHint:
    "Rework the hero: left-align the copy, drop the pill badge, show the real product (screenshot or code) beside it, and write one specific CTA instead of the Get Started / Learn More pair.",
  check(ctx) {
    const matches = new Map<ElementNode, HeroSignals>();
    for (const el of ctx.file.allElements) {
      if (!isHeroCandidate(el)) continue;
      const signals = heroSignals(ctx, el);
      if (signals.full || signals.partial) matches.set(el, signals);
    }
    for (const [el, signals] of matches) {
      const hasDeeperMatch = [...matches.keys()].some((other) => other !== el && [...ctx.ancestors(other)].includes(el));
      if (hasDeeperMatch) continue;
      const buttons = signals.ctas.map((t) => `"${t}"`).join("/");
      const plural = signals.ctas.length > 1 ? "buttons" : "button";
      ctx.report({
        line: el.line,
        column: el.column,
        anchorLine: el.line,
        severity: signals.full ? undefined : "warn",
        message: signals.full
          ? `Template hero: centered headline with pill badge and ${buttons} ${plural}`
          : `Template hero: centered headline and ${buttons} ${plural}`,
      });
    }
  },
};

const ROUNDED_3XL_RE = /^rounded(-[trblse]{1,2})?-3xl$/;
const ROUNDED_ARBITRARY_RE = /^rounded(-[trblse]{1,2})?-\[/;

function largeRadius(value: string): boolean {
  const match = /^(\d*\.?\d+)(px|rem)$/.exec(value.trim());
  if (!match) return false;
  const px = match[2] === "rem" ? Number(match[1]) * 16 : Number(match[1]);
  return px >= 24;
}

export const rounded3xlOveruse: Rule = {
  id: "layout-slop/rounded-3xl-overuse",
  category: "layout-slop",
  weight: 1,
  defaultSeverity: "warn",
  summary: "rounded-3xl (24px+) radius repeated across a file",
  appliesTo: ["tsx", "jsx", "css", "html"],
  defaultOptions: { minCount: 3 },
  fixHint: "Use one radius for surfaces (rounded-lg or rounded-xl) and rounded-full only for avatars and pills.",
  check(ctx) {
    const hits: { line: number; column: number; anchorLine?: number }[] = [];
    for (const token of ctx.file.classTokens) {
      const big = ROUNDED_3XL_RE.test(token.core) || (ROUNDED_ARBITRARY_RE.test(token.core) && largeRadius(token.arbitrary ?? ""));
      if (big) hits.push({ line: token.line, column: token.column, anchorLine: anchorOf(token) });
    }
    for (const decl of ctx.file.decls) {
      if (decl.prop !== "border-radius") continue;
      const match = /^(\d*\.?\d+)px\b/.exec(decl.value.trim());
      if (match && Number(match[1]) >= 24 && Number(match[1]) <= 48) hits.push({ line: decl.line, column: decl.column });
    }
    if (hits.length < Number(ctx.options.minCount)) return;
    for (const hit of hits) ctx.report({ ...hit, message: `rounded-3xl used ${hits.length}x in this file` });
  },
};

const INTERACTIVE_VARIANT_RE = /^(hover|focus|group-hover|peer-.*|active)$/;

function heavyToken(group: ClassToken[], token: ClassToken): boolean {
  if (token.core !== "shadow-xl" && token.core !== "shadow-2xl") return false;
  if (token.variants.some((v) => INTERACTIVE_VARIANT_RE.test(v))) return false;
  const cores = group.map((t) => t.core);
  const surface = cores.some((c) => c.startsWith("rounded") || c.startsWith("bg-"));
  const floating = cores.some((c) => c === "fixed" || c === "absolute" || c === "sticky");
  return surface && !floating;
}

export const heavyShadow: Rule = {
  id: "layout-slop/heavy-shadow",
  category: "layout-slop",
  weight: 1,
  defaultSeverity: "warn",
  summary: "shadow-xl and shadow-2xl on flat cards",
  appliesTo: ["tsx", "jsx", "css", "html"],
  defaultOptions: { minCount: 2 },
  fixHint: "Use shadow-sm or a 1px border (border-zinc-200); reserve large shadows for popovers and modals.",
  check(ctx) {
    const hits: { line: number; column: number; anchorLine?: number; label: string }[] = [];
    for (const group of groupTokens(ctx.file.classTokens)) {
      for (const token of group) {
        if (heavyToken(group, token)) hits.push({ line: token.line, column: token.column, anchorLine: anchorOf(token), label: token.raw });
      }
    }
    for (const decl of ctx.file.decls) {
      if (decl.prop !== "box-shadow") continue;
      if (parseShadowList(decl.value).some((s) => s.y + s.blur >= 45)) {
        hits.push({ line: decl.line, column: decl.column, label: `box-shadow: ${decl.value}` });
      }
    }
    if (hits.length < Number(ctx.options.minCount)) return;
    for (const { label, ...hit } of hits) ctx.report({ ...hit, message: `Heavy ${label} on a flat surface` });
  },
};

export const layoutSlopRules: Rule[] = [iconCardGrid, identicalCardGrid, templateHero, rounded3xlOveruse, heavyShadow];
