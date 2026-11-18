import type { LineIndex, Pos } from "../types";

export function createLineIndex(source: string): LineIndex {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) starts.push(i + 1);
  }
  const pos = (offset: number): Pos => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((starts[mid] as number) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { offset, line: lo + 1, column: offset - (starts[lo] as number) + 1 };
  };
  const lineText = (line: number): string => {
    const start = starts[line - 1];
    if (start === undefined) return "";
    const next = starts[line];
    const end = next === undefined ? source.length : next - 1;
    return source.slice(start, end).replace(/\r$/, "");
  };
  return { pos, lineText, lineCount: starts.length };
}
