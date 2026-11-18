import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function logic(i: number): string {
  return Array.from(
    { length: 6 },
    (_, j) => `type Filter${j} = { field: "name" | "status" | "owner"; value: string; negate?: boolean };

export function apply${j}(rows: Row${i}[], filters: Filter${j}[]): Row${i}[] {
  return rows.filter((row) =>
    filters.every((filter) => {
      const matches = String(row[filter.field as keyof Row${i}]).toLowerCase().includes(filter.value.toLowerCase());
      return filter.negate ? !matches : matches;
    }),
  );
}

function reducer${j}(state: State${i}, action: Action${i}): State${i} {
  switch (action.type) {
    case "select":
      return { ...state, selected: action.id };
    case "clear":
      return { ...state, selected: null };
    default:
      return state;
  }
}
`,
  ).join("\n");
}

function component(i: number): string {
  const cards = Array.from(
    { length: 3 },
    (_, j) => `        <div className="rounded-3xl bg-white p-8 shadow-2xl">
          <div className="size-12 rounded-2xl bg-indigo-100">🚀</div>
          <h3 className="mt-4 text-xl font-semibold">Feature ${i}-${j}</h3>
          <p className="mt-2 text-zinc-600">Supercharge your workflow with seamless, powerful tooling.</p>
        </div>`,
  ).join("\n");
  const rows = Array.from(
    { length: 12 },
    (_, j) => `          <tr key="${j}"><td className="px-4">Row ${j}</td><td className="tabular-nums">{rows[${j}]?.total}</td></tr>`,
  ).join("\n");
  return `import { useReducer } from "react";
import { cn } from "./cn";

interface Row${i} {
  name: string;
  status: string;
  owner: string;
  total: number;
}
interface State${i} {
  selected: string | null;
}
type Action${i} = { type: "select"; id: string } | { type: "clear" };

${logic(i)}
export function Page${i}({ rows, onSave }: { rows: Row${i}[]; onSave: (id: string) => void }) {
  const [state, dispatch] = useReducer(reducer0, { selected: null });
  return (
    <main className={cn("min-h-screen", state.selected ? "bg-zinc-50" : "bg-white")}>
      <section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-center items-center px-6 py-24">
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm">✨ New in ${i}</span>
        <h1 className="text-6xl font-bold">Unleash the power of page ${i}</h1>
        <button className="shadow-lg shadow-purple-500/50" onClick={() => dispatch({ type: "clear" })}>Get Started</button>
        <a href="#">Learn More</a>
      </section>
      <div className="grid grid-cols-3 gap-8">
${cards}
      </div>
      <table className="w-full">
        <tbody>
${rows}
        </tbody>
      </table>
      <button type="button" onClick={() => onSave(state.selected ?? "")} className="rounded-lg border border-zinc-200 px-3 py-2">
        Save view
      </button>
    </main>
  );
}
`;
}

function stylesheet(i: number): string {
  const neutral = Array.from(
    { length: 36 },
    (_, j) => `.item-${i}-${j} {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  color: #18181b;
  border-bottom: 1px solid #e4e4e7;
}
`,
  ).join("\n");
  return `${neutral}
.hero-${i} {
  background: linear-gradient(90deg, #8b5cf6, #ec4899);
  border-radius: 32px;
}

.card-${i} {
  border-radius: 32px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}
`;
}

function page(i: number): string {
  const sections = Array.from(
    { length: 20 },
    (_, j) => `    <section class="px-6 py-12">
      <h2 class="text-2xl font-semibold">Release notes ${j}</h2>
      <p class="max-w-prose text-zinc-600">Version ${j} fixes the export timeout and adds a CSV download to the audit log.</p>
      <ul>
        <li><a href="/changelog/${j}">Changelog</a></li>
        <li><a href="/docs/${j}">Docs</a></li>
      </ul>
    </section>`,
  ).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
  <head><title>Page ${i}</title></head>
  <body>
    <header class="text-center">
      <h1 class="text-5xl font-bold">Revolutionize your releases</h1>
      <p>Join 10,000+ users. <a href="#">Learn more</a> <span>🔥</span></p>
    </header>
${sections}
  </body>
</html>
`;
}

export function writeCorpus(dir: string): number {
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "styles"), { recursive: true });
  mkdirSync(join(dir, "public"), { recursive: true });
  for (let i = 0; i < 200; i++) writeFileSync(join(dir, "src", `Page${i}.tsx`), component(i));
  for (let i = 0; i < 50; i++) writeFileSync(join(dir, "styles", `s${i}.css`), stylesheet(i));
  for (let i = 0; i < 50; i++) writeFileSync(join(dir, "public", `p${i}.html`), page(i));
  return 300;
}
