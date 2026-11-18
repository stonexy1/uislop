import { ICON_PROP_KEY_RE } from "../parse/text";
import { emojiRuns } from "./data/emoji";
import { locateText } from "./helpers";
import type { ElementNode, Rule, RuleContext, TextNode } from "../types";

const SKIPPED_TAGS = new Set(["title", "option"]);
const MAX_LABEL_CHARS = 2;
const ICON_SIZE_RE = /^text-(xl|[2-6]xl)$/;

function isAccessibleEmoji(el: ElementNode | null): boolean {
  for (const node of [el, el?.parent ?? null]) {
    if (!node) continue;
    if (node.attrs.get("role")?.value === "img" || node.attrs.has("aria-label")) return true;
  }
  return false;
}

function usedAsIcon(ctx: RuleContext, node: TextNode, run: string): boolean {
  if (node.origin === "prop") return ICON_PROP_KEY_RE.test(node.attrName ?? "");
  const el = node.element;
  if (!el || node.origin === "attr") return false;
  const direct = el.texts.map((t) => t.text).join(" ").trim();
  if (el.children.length === 0 && direct === run) return true;
  if (el.tag === "button" || el.tag === "Button") return true;
  if (el.tag === "li" && el.texts[0] === node && node.text.startsWith(run)) return true;
  const inSentence = direct.replace(run, "").replace(/\s/g, "").length > MAX_LABEL_CHARS;
  if (inSentence) return false;
  const classes = ctx.classesOf(el);
  if (classes.some((t) => ICON_SIZE_RE.test(t.core))) return true;
  const hasW = classes.some((t) => /^(w|size)-/.test(t.core));
  const hasH = classes.some((t) => /^(h|size)-/.test(t.core));
  return hasW && hasH;
}

export const emojiInJsx: Rule = {
  id: "emoji-ui/emoji-in-jsx",
  category: "emoji-ui",
  weight: 2,
  defaultSeverity: "warn",
  summary: "Emoji used as icons or decoration in UI text",
  appliesTo: ["tsx", "jsx", "css", "html"],
  fixHint:
    'Replace with an SVG icon: lucide-react (e.g. <Rocket className="size-5" aria-hidden />) or an inline <svg>. Remove it if it only decorates a sentence.',
  check(ctx) {
    for (const node of ctx.file.texts) {
      if (node.element && (SKIPPED_TAGS.has(node.element.tag) || isAccessibleEmoji(node.element))) continue;
      for (const run of emojiRuns(node.text)) {
        const icon = usedAsIcon(ctx, node, run.text);
        const pos = locateText(ctx.file, node, run.text);
        ctx.report({
          line: pos.line,
          column: pos.column,
          severity: icon ? "error" : undefined,
          anchorLine: node.element?.line ?? node.line,
          message: `Emoji "${run.text}" used as UI ${icon ? "icon" : "decoration"}`,
        });
      }
    }
    for (const decl of ctx.file.decls) {
      if (decl.prop !== "content") continue;
      for (const run of emojiRuns(decl.value)) {
        ctx.report({ line: decl.line, column: decl.column, message: `Emoji "${run.text}" used as UI decoration` });
      }
    }
  },
};

export const emojiUiRules: Rule[] = [emojiInJsx];
