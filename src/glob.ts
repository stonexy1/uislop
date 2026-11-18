const cache = new Map<string, RegExp>();

function escapeChar(c: string): string {
  return /[.+^$()|\\]/.test(c) ? `\\${c}` : c;
}

function translate(pattern: string): string {
  let out = "";
  let i = 0;
  let braceDepth = 0;
  while (i < pattern.length) {
    const c = pattern[i] as string;
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        const atSegmentStart = i === 0 || pattern[i - 1] === "/";
        const atSegmentEnd = i + 2 === pattern.length || pattern[i + 2] === "/";
        if (atSegmentStart && atSegmentEnd) {
          if (pattern[i + 2] === "/") {
            out += "(?:.*/)?";
            i += 3;
          } else {
            out += ".*";
            i += 2;
          }
          continue;
        }
        out += "[^/]*";
        i += 2;
        continue;
      }
      out += "[^/]*";
    } else if (c === "?") {
      out += "[^/]";
    } else if (c === "{") {
      braceDepth++;
      out += "(?:";
    } else if (c === "}" && braceDepth > 0) {
      braceDepth--;
      out += ")";
    } else if (c === "," && braceDepth > 0) {
      out += "|";
    } else if (c === "[") {
      const close = pattern.indexOf("]", i + 1);
      if (close === -1) {
        out += "\\[";
      } else {
        out += `[${pattern.slice(i + 1, close).replace(/^!/, "^").replace(/\\/g, "\\\\")}]`;
        i = close;
      }
    } else {
      out += escapeChar(c);
    }
    i++;
  }
  return out;
}

export function globToRegExp(pattern: string): RegExp {
  const cached = cache.get(pattern);
  if (cached) return cached;
  let p = pattern.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!p.includes("/")) p = `**/${p}`;
  const re = new RegExp(`^${translate(p)}(?:/.*)?$`);
  cache.set(pattern, re);
  return re;
}

export function matchesAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => globToRegExp(p).test(path));
}
