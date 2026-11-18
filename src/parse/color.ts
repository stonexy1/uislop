export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  indigo: "#4b0082",
  violet: "#ee82ee",
  purple: "#800080",
  fuchsia: "#ff00ff",
  magenta: "#ff00ff",
  blueviolet: "#8a2be2",
  mediumpurple: "#9370db",
  rebeccapurple: "#663399",
  darkviolet: "#9400d3",
  orchid: "#da70d6",
  mediumorchid: "#ba55d3",
  hotpink: "#ff69b4",
  deeppink: "#ff1493",
  blue: "#0000ff",
  dodgerblue: "#1e90ff",
  deepskyblue: "#00bfff",
  cyan: "#00ffff",
  aqua: "#00ffff",
  teal: "#008080",
  orange: "#ffa500",
  coral: "#ff7f50",
  red: "#ff0000",
  crimson: "#dc143c",
};

function channel(token: string, max: number): number {
  return token.endsWith("%") ? (parseFloat(token) / 100) * max : parseFloat(token);
}

function alpha(token: string | undefined): number {
  if (token === undefined) return 1;
  return token.endsWith("%") ? parseFloat(token) / 100 : parseFloat(token);
}

function fnArgs(body: string): string[] {
  return body.replace(/\//g, " / ").split(/[\s,]+/).filter((t) => t.length > 0 && t !== "/");
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

export function parseColor(input: string): Rgba | null {
  const value = input.trim().toLowerCase();
  if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const named = NAMED[value];
  if (named) return parseColor(named);
  const hex = /^#([0-9a-f]{3,8})$/.exec(value);
  if (hex) {
    let digits = hex[1] as string;
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map((d) => d + d).join("");
    if (digits.length !== 6 && digits.length !== 8) return null;
    const n = (i: number) => parseInt(digits.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: digits.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = /^(rgba?|hsla?)\((.*)\)$/.exec(value);
  if (!fn) return null;
  const args = fnArgs(fn[2] as string);
  if (args.length < 3 || args.slice(0, 3).some((a) => Number.isNaN(parseFloat(a)))) return null;
  if ((fn[1] as string).startsWith("rgb")) {
    return {
      r: channel(args[0] as string, 255),
      g: channel(args[1] as string, 255),
      b: channel(args[2] as string, 255),
      a: alpha(args[3]),
    };
  }
  const [r, g, b] = hslToRgb(parseFloat(args[0] as string), parseFloat(args[1] as string) / 100, parseFloat(args[2] as string) / 100);
  return { r, g, b, a: alpha(args[3]) };
}

export function toHsl({ r, g, b }: Rgba): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export function inAiRange(color: Rgba): boolean {
  const { h, s, l } = toHsl(color);
  return h >= 245 && h <= 335 && s >= 0.35 && l >= 0.2 && l <= 0.85;
}

export function inPartnerRange(color: Rgba): boolean {
  const { h, s } = toHsl(color);
  if (s < 0.4) return false;
  return (h >= 170 && h <= 244) || h >= 335 || h <= 45;
}

export function isPureBlack(color: Rgba): boolean {
  return color.r === 0 && color.g === 0 && color.b === 0 && color.a === 1;
}

export function isPureWhite(color: Rgba): boolean {
  return color.r === 255 && color.g === 255 && color.b === 255 && color.a === 1;
}

const COLOR_TOKEN_RE = /#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)|\b[a-z]+\b/gi;

export function extractColors(value: string): { text: string; color: Rgba }[] {
  const out: { text: string; color: Rgba }[] = [];
  const masked = value.replace(/var\([^)]*\)/gi, " ");
  for (const match of masked.matchAll(COLOR_TOKEN_RE)) {
    const color = parseColor(match[0]);
    if (color && color.a > 0) out.push({ text: match[0], color });
  }
  return out;
}

export function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && (separator === " " ? /\s/.test(c as string) : c === separator)) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  color: Rgba | null;
}

function length(token: string): number | null {
  const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(token);
  if (!m) return null;
  const n = parseFloat(m[1] as string);
  return m[2] === "rem" || m[2] === "em" ? n * 16 : n;
}

export function parseShadowList(value: string): Shadow[] {
  return splitTopLevel(value, ",").map((shadow) => {
    const lengths: number[] = [];
    let color: Rgba | null = null;
    for (const token of splitTopLevel(shadow, " ")) {
      const len = length(token);
      if (len !== null) lengths.push(len);
      else color ??= parseColor(token);
    }
    return { x: lengths[0] ?? 0, y: lengths[1] ?? 0, blur: lengths[2] ?? 0, color };
  });
}
