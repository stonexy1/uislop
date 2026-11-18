const WIDTHS: Record<string, number> = {
  " ": 352, "!": 342, '"': 459, "#": 818, $: 636, "%": 1076, "&": 727, "'": 269, "(": 454, ")": 454, "*": 636,
  "+": 818, ",": 364, "-": 454, ".": 364, "/": 454, ":": 454, ";": 454, "<": 818, "=": 818, ">": 818, "?": 545,
  "@": 1000, A: 684, B: 686, C: 698, D: 770, E: 632, F: 575, G: 775, H: 752, I: 421, J: 455, K: 692, L: 556, M: 842,
  N: 748, O: 787, P: 603, Q: 787, R: 695, S: 684, T: 616, U: 732, V: 684, W: 989, X: 685, Y: 614, Z: 685, "[": 454,
  "\\": 454, "]": 454, "^": 818, _: 636, "`": 636, a: 601, b: 623, c: 521, d: 623, e: 596, f: 352, g: 623, h: 633,
  i: 274, j: 344, k: 592, l: 274, m: 973, n: 633, o: 607, p: 623, q: 623, r: 427, s: 521, t: 394, u: 633, v: 592,
  w: 818, x: 592, y: 592, z: 525, "{": 636, "|": 454, "}": 636, "~": 818, "·": 364,
};
const DIGIT_WIDTH = 636;
const FALLBACK_WIDTH = 600;
const FONT_SIZE = 11;

export function textWidth(text: string): number {
  let units = 0;
  for (const char of text) units += /\d/.test(char) ? DIGIT_WIDTH : (WIDTHS[char] ?? FALLBACK_WIDTH);
  return (units / 1000) * FONT_SIZE;
}
