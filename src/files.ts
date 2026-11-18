import { readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { matchesAny } from "./glob";
import type { FileEntry, FileKind, UislopConfig } from "./types";

export const DEFAULT_EXCLUDES = [
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.stories.*",
  "**/__tests__/**",
  "**/__mocks__/**",
  "**/*.min.*",
];

const PRUNED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  "storybook-static",
]);

const KIND_BY_EXT: Record<string, FileKind> = {
  ".tsx": "tsx",
  ".jsx": "jsx",
  ".css": "css",
  ".html": "html",
  ".htm": "html",
};

export function kindOf(path: string): FileKind | undefined {
  return KIND_BY_EXT[extname(path).toLowerCase()];
}

function isPruned(name: string): boolean {
  return name.startsWith(".") || PRUNED_DIRS.has(name);
}

function toPosix(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

export function walkFiles(root: string, targets: string[], config: UislopConfig): FileEntry[] {
  const excludes = config.useDefaultExcludes ? [...DEFAULT_EXCLUDES, ...config.exclude] : config.exclude;
  const files: FileEntry[] = [];
  const seen = new Set<string>();

  const consider = (abs: string, size: number): void => {
    const kind = kindOf(abs);
    if (!kind || seen.has(abs)) return;
    seen.add(abs);
    const rel = toPosix(relative(root, abs)) || toPosix(abs);
    if (!matchesAny(rel, config.include) || matchesAny(rel, excludes)) return;
    files.push({ abs, rel, kind, size });
  };

  const visit = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!isPruned(entry.name)) visit(abs);
      } else if (entry.isFile() && kindOf(entry.name)) {
        consider(abs, statSync(abs).size);
      }
    }
  };

  for (const target of targets) {
    const stat = statSync(target);
    if (stat.isDirectory()) visit(target);
    else if (stat.isFile()) consider(target, stat.size);
  }
  files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return files;
}
