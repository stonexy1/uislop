import { NPX, TARGET_SLOP } from "./meta";
import type { Category, Finding, ScanResult } from "./types";

export interface PromptOptions {
  path: string;
  maxFindings?: number;
  charBudget?: number;
}

const PER_FILE_CAP = 8;

const DIRECTION: Record<Category, string> = {
  "color-slop":
    "Palette: neutrals from zinc/slate/neutral (text-zinc-900, bg-zinc-50, border-zinc-200); one accent used on primary actions only; no purple/indigo/pink gradients, no colored glows, no pure #000.",
  "emoji-ui": "Icons: SVG icons (lucide-react or inline SVG) sized 16-20px with aria-hidden; no emoji as UI.",
  "copy-slop": "Copy: specific and concrete; say what the product does for whom; no hype adjectives; realistic, varied sample names and data.",
  "layout-slop":
    "Layout: break the symmetry: asymmetric grids, one radius (rounded-lg/xl), border instead of heavy shadows, a left-aligned hero with the real product visible.",
  "typo-slop": "Typography: tabular-nums on every number/price/table cell; paragraphs capped with max-w-prose.",
  "fake-ui": "Honesty: no dead links, no no-op buttons, no invented stats or testimonials; use real data or remove it.",
};
const CATEGORY_ORDER: Category[] = ["color-slop", "emoji-ui", "copy-slop", "layout-slop", "typo-slop", "fake-ui"];

function entry(f: Finding): string {
  return `- L${f.line}:${f.column} [${f.ruleId}] ${f.message}\n  Fix: ${f.fixHint}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function selectFindings(findings: Finding[], maxFindings: number, charBudget: number): Finding[] {
  const ranked = [...findings].sort(
    (a, b) => b.points - a.points || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.line - b.line || a.column - b.column,
  );
  const selected: Finding[] = [];
  const perFile = new Map<string, number>();
  let length = 0;
  for (const finding of ranked) {
    if (selected.length >= maxFindings) break;
    const count = perFile.get(finding.file) ?? 0;
    if (count >= PER_FILE_CAP) continue;
    const size = entry(finding).length + 1;
    if (length + size > charBudget) continue;
    length += size;
    perFile.set(finding.file, count + 1);
    selected.push(finding);
  }
  return selected;
}

export function buildPrompt(scan: ScanResult, options: PromptOptions): string {
  const { score } = scan;
  const selected = selectFindings(scan.findings, options.maxFindings ?? 30, options.charBudget ?? 6000);
  const byFile = new Map<string, Finding[]>();
  for (const f of selected) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  const fileOrder = [...byFile.entries()].sort(
    (a, b) => b[1].reduce((s, f) => s + f.points, 0) - a[1].reduce((s, f) => s + f.points, 0) || (a[0] < b[0] ? -1 : 1),
  );
  const shown = new Set(selected);
  const hidden = scan.findings.filter((f) => !shown.has(f));
  const triggered = new Set(scan.findings.map((f) => f.category));

  const lines: string[] = [
    `You are fixing the visual design of an existing front-end codebase. A static analyzer (uislop) scored it ${score.score}/100 ("${score.tierLabel}"; lower is better) because it reads as AI-generated. Fix only the design issues listed below.`,
    "",
    "HARD CONSTRAINTS",
    "- Do NOT change business logic: props, state, hooks, event handler bodies, data fetching, routing, form validation, API calls, types, or tests.",
    "- Change presentation only: className/class strings, inline styles, CSS, static copy, icons, and the minimum markup (wrappers, semantics) needed for layout.",
    "- Keep every import, export and component signature working. For icons, use the icon library already installed (lucide-react if present), otherwise inline SVG. Do not add dependencies.",
    "- Wire-ups flagged as fake (dead links, empty or console-only handlers) are the exception: connect them to the real function or route that already exists in the code; if none exists, remove the control and say so in your summary.",
    "- If a finding is intentional, keep the code and add `// uislop-ignore <rule-id>` above it ({/* uislop-ignore <rule-id> */} in JSX children, /* … */ in CSS, <!-- … --> in HTML) instead of rewriting.",
    "",
    `FINDINGS (${selected.length} of ${scan.findings.length}, highest impact first)`,
  ];
  fileOrder.forEach(([file, list], i) => {
    if (i > 0) lines.push("");
    lines.push(file);
    for (const f of [...list].sort((a, b) => a.line - b.line || a.column - b.column)) lines.push(entry(f));
  });
  if (hidden.length > 0) {
    const moreFiles = new Set(hidden.map((f) => f.file)).size;
    lines.push(
      "",
      `…and ${plural(hidden.length, "more finding")} in ${plural(moreFiles, "file")}. After fixing the above, re-run the check; the next ones will surface.`,
    );
  }
  lines.push("", "DESIGN DIRECTION");
  for (const category of CATEGORY_ORDER) if (triggered.has(category)) lines.push(`- ${DIRECTION[category]}`);
  lines.push(
    "- Prefer restraint: one accent color, one radius, one shadow level, consistent 4px spacing.",
    "",
    "VERIFY",
    `1. Run \`${NPX} ${options.path} --ci --max-slop ${TARGET_SLOP}\` and repeat until it exits 0. Do not satisfy it by adding uislop-ignore comments to real problems.`,
    "2. Run the project's typecheck, lint and tests; they must behave exactly as before your changes.",
    "3. Reply with a short per-file summary (at most 5 lines) of what you changed.",
  );
  return lines.join("\n");
}
