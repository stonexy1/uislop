const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function normalizeForPhrases(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚‛']/g, " ")
    .replace(/[“”„"]/g, '"')
    .replace(/[-_‐-—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const COPY_ATTRS = new Set([
  "alt", "title", "aria-label", "placeholder", "label", "description", "subtitle", "heading", "headline", "text",
  "tagline", "caption", "quote", "content", "cta", "badge", "tooltip", "message", "summary", "author", "company",
  "username", "person", "customer",
]);

export const COPY_PROP_KEY_RE =
  /^(title|subtitle|heading|headline|description|desc|text|label|tagline|caption|quote|content|blurb|summary|cta|badge|author|name|role|company|metric|value|stat|icon|emoji)$/i;

export const ICON_PROP_KEY_RE = /^(icon|emoji)$/i;
