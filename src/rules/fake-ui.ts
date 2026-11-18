import type { ElementNode, Rule, TextNode } from "../types";

const DEAD_HREFS = new Set(["#", "#!", "", "javascript:void(0)", "javascript:;", "javascript:void(0);"]);
const TOGGLE_ATTRS = ["data-toggle", "data-bs-toggle", "data-bs-target", "data-target"];
const ACTION_ATTRS = new Set(["onClick", "onSubmit", "onPress", "onTap", "onclick", "onsubmit"]);
const SUBMIT_ATTRS = new Set(["onSubmit", "onsubmit"]);

function hasRealClick(el: ElementNode): boolean {
  const handler = (el.attrs.get("onClick") ?? el.attrs.get("onclick"))?.handler;
  return handler !== undefined && handler !== "empty" && handler !== "noop-ident";
}

export const deadLink: Rule = {
  id: "fake-ui/dead-link",
  category: "fake-ui",
  weight: 2,
  defaultSeverity: "warn",
  summary: 'Links to "#" or javascript:void(0)',
  appliesTo: ["tsx", "jsx", "html"],
  fixHint: 'Point it at a real route or anchor (href="/pricing", "#features"), or render a <button type="button"> if it triggers an action.',
  check(ctx) {
    for (const el of ctx.file.allElements) {
      const isLink = el.isComponent ? /Link$/.test(el.tag) : el.tag === "a";
      if (!isLink) continue;
      const attr = el.attrs.get("href") ?? (el.isComponent ? el.attrs.get("to") : undefined);
      if (!attr || attr.value === null || !DEAD_HREFS.has(attr.value.trim())) continue;
      if (hasRealClick(el)) continue;
      if (TOGGLE_ATTRS.some((name) => el.attrs.has(name)) || el.attrs.get("role")?.value === "button") continue;
      ctx.report({ line: attr.line, column: attr.column, anchorLine: el.line, message: `Dead link: href="${attr.value}"` });
    }
  },
};

export const noopHandler: Rule = {
  id: "fake-ui/noop-handler",
  category: "fake-ui",
  weight: 2,
  defaultSeverity: "warn",
  summary: "Buttons and forms whose handler does nothing",
  appliesTo: ["tsx", "jsx", "html"],
  fixHint: "Wire it to the real action (call the existing function/mutation), or remove the button; do not leave decorative controls.",
  check(ctx) {
    for (const el of ctx.file.allElements) {
      for (const attr of el.attrs.values()) {
        if (!ACTION_ATTRS.has(attr.name) || !attr.handler) continue;
        const noop =
          attr.handler === "empty" ||
          attr.handler === "noop-ident" ||
          (attr.handler === "preventdefault-only" && SUBMIT_ATTRS.has(attr.name));
        if (!noop) continue;
        ctx.report({ line: attr.line, column: attr.column, anchorLine: el.line, message: `Button does nothing: ${attr.name} handler is empty` });
      }
    }
  },
};

export const consoleHandler: Rule = {
  id: "fake-ui/console-handler",
  category: "fake-ui",
  weight: 2,
  defaultSeverity: "warn",
  summary: "Handlers that only log or alert",
  appliesTo: ["tsx", "jsx", "html"],
  fixHint: "Replace the console.log/alert with the real behavior, or remove the control.",
  check(ctx) {
    for (const el of ctx.file.allElements) {
      for (const attr of el.attrs.values()) {
        if (!ACTION_ATTRS.has(attr.name)) continue;
        if (attr.handler !== "console" && attr.handler !== "alert") continue;
        const call = attr.handler === "console" ? "console.log" : "alert";
        ctx.report({ line: attr.line, column: attr.column, anchorLine: el.line, message: `Handler only calls ${call}` });
      }
    }
  },
};

const METRIC_NOUNS =
  "users|customers|developers|teams|companies|businesses|creators|downloads|members|clients|professionals|startups|brands|marketers|designers|reviews|projects|installs";
const METRIC_PATTERNS: RegExp[] = [
  /\b99\.[5-9]\d{0,2}\s?%/g,
  /\b100\s?%\s+(satisfaction|guarantee|uptime|secure)/gi,
  new RegExp(`(?<![\\w.])(\\d{1,3}(?:,\\d{3})+\\+?|\\d+(?:\\.\\d+)?[kKmM]\\+?|\\d{2,}\\+)\\s+(?:\\w+\\s+){0,2}(${METRIC_NOUNS})\\b`, "gi"),
  /\b[45]\.\d\s?\/\s?5\b/g,
  /\b[45]\.\d\s?(out of 5|stars?|★)/gi,
  /[★⭐]{5}/gu,
];
const METRIC_HINT_RE = /[\d★⭐]/u;
const PURE_NUMBER_RE = /^(\d{1,3}(,\d{3})+\+?|\d+[kKmM]\+|\d{2,3}(\.\d+)?%)$/;
const CONTEXT_RE = new RegExp(`\\b(${METRIC_NOUNS}|uptime|satisfaction)\\b`, "i");

export const fakeMetric: Rule = {
  id: "fake-ui/fake-metric",
  category: "fake-ui",
  weight: 3,
  defaultSeverity: "warn",
  summary: "Invented uptime, user counts and star ratings",
  appliesTo: ["tsx", "jsx", "html"],
  fixHint: "Remove it, or replace it with a real number from your data and a dated source; unverifiable social proof erodes trust.",
  check(ctx) {
    const report = (node: TextNode, text: string) =>
      ctx.report({ line: node.line, column: node.column, anchorLine: node.element?.line ?? node.line, message: `Invented metric "${text}"` });
    for (const node of ctx.file.texts) {
      if (!METRIC_HINT_RE.test(node.text)) continue;
      let matched = false;
      for (const re of METRIC_PATTERNS) {
        re.lastIndex = 0;
        for (let match = re.exec(node.text); match; match = re.exec(node.text)) {
          matched = true;
          report(node, match[0]);
        }
      }
      if (matched || !PURE_NUMBER_RE.test(node.text)) continue;
      const parent = node.element?.parent;
      if (parent && CONTEXT_RE.test(ctx.textOf(parent))) report(node, node.text);
    }
  },
};

const PLACEHOLDER_HOST_RE =
  /via\.placeholder\.com|placehold\.co|placeholder\.com|dummyimage\.com|picsum\.photos|i\.pravatar\.cc|randomuser\.me\/api\/portraits|loremflickr\.com|placekitten\.com|source\.unsplash\.com|images\.unsplash\.com\/random|\/placeholder\.(svg|png|jpg)/i;
const ASSET_ATTRS = ["src", "srcSet", "srcset", "poster", "href", "content"];

export const placeholderAsset: Rule = {
  id: "fake-ui/placeholder-asset",
  category: "fake-ui",
  weight: 1.5,
  defaultSeverity: "warn",
  summary: "Stock placeholder images and random avatars",
  appliesTo: ["tsx", "jsx", "css", "html"],
  fixHint: "Use a real image from your assets (or a deliberate illustration); avoid stock placeholders and random avatars.",
  check(ctx) {
    for (const el of ctx.file.allElements) {
      for (const name of ASSET_ATTRS) {
        const attr = el.attrs.get(name);
        const match = attr?.value ? PLACEHOLDER_HOST_RE.exec(attr.value) : null;
        if (attr && match) ctx.report({ line: attr.line, column: attr.column, anchorLine: el.line, message: `Placeholder asset ${match[0]}` });
      }
    }
    for (const decl of ctx.file.decls) {
      const url = /url\(([^)]*)\)/i.exec(decl.value);
      const match = url ? PLACEHOLDER_HOST_RE.exec(url[1] as string) : null;
      if (match) ctx.report({ line: decl.line, column: decl.column, message: `Placeholder asset ${match[0]}` });
    }
  },
};

export const fakeUiRules: Rule[] = [deadLink, noopHandler, consoleHandler, fakeMetric, placeholderAsset];
