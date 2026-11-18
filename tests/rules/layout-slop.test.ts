import { describe, expect, it } from "vitest";
import { runRule } from "../helpers";

const ICON = "layout-slop/icon-card-grid";
const PLAIN = "layout-slop/identical-card-grid";
const HERO = "layout-slop/template-hero";

const iconCard = '<div className="rounded-xl p-6"><div className="size-10 rounded-lg bg-zinc-100"><Zap /></div><h3>T</h3><p>D</p></div>';
const plainCard = '<div className="rounded-xl p-6"><h3>T</h3><p>D</p><span>x</span></div>';
const grid = (cards: string, cls = "grid grid-cols-3 gap-6") => `<div className="${cls}">${cards}</div>`;

describe("card grids", () => {
  it("flags three identical icon cards as icon-card-grid only", () => {
    const source = grid(iconCard.repeat(3));
    expect(runRule(ICON, source)[0]?.message).toBe("3 identical feature cards (icon tile, heading, paragraph) in a 3-column grid");
    expect(runRule(PLAIN, source)).toHaveLength(0);
  });

  it("flags identical cards without icons as identical-card-grid", () => {
    expect(runRule(PLAIN, grid(plainCard.repeat(3)))[0]?.message).toBe("3 identical cards (heading + paragraph) in a grid");
    expect(runRule(ICON, grid(plainCard.repeat(3)))).toHaveLength(0);
  });

  it("does not flag two cards, nav lists or non-grid parents", () => {
    expect(runRule(PLAIN, grid(plainCard.repeat(2)))).toHaveLength(0);
    expect(runRule(PLAIN, '<ul className="flex gap-4"><li><a href="/a">A</a></li><li><a href="/b">B</a></li><li><a href="/c">C</a></li></ul>')).toHaveLength(0);
    expect(runRule(PLAIN, `<div className="space-y-4">${plainCard.repeat(3)}</div>`)).toHaveLength(0);
  });

  it("counts .map over a same-file const array but not over props", () => {
    const mapped = `const items = [1, 2, 3, 4, 5, 6];\nexport const F = () => <div className="grid md:grid-cols-3 gap-4">{items.map((i) => (${plainCard}))}</div>;`;
    expect(runRule(PLAIN, mapped)[0]?.message).toBe("6 identical cards (heading + paragraph) in a grid");
    const dynamic = `export const F = ({ items }) => <div className="grid grid-cols-3 gap-4">{items.map((i) => (${plainCard}))}</div>;`;
    expect(runRule(PLAIN, dynamic)).toHaveLength(0);
  });

  it("flags emoji icon tiles and card components with icon props", () => {
    const emojiCard = '<div><div className="size-12 rounded-2xl bg-indigo-100">🚀</div><h3>T</h3><p>D</p></div>';
    expect(runRule(ICON, grid(emojiCard.repeat(3)))).toHaveLength(1);
    const components = '<FeatureCard icon="zap" title="Fast" description="Builds" />'.repeat(4);
    expect(runRule(ICON, grid(components, "grid grid-cols-4 gap-4"))[0]?.message).toContain("4 identical feature cards");
  });
});

describe("layout-slop/template-hero", () => {
  const hero = (pill: string, ctas: string) => `<section className="text-center items-center py-24">
    ${pill}
    <h1 className="text-6xl font-bold">Big idea</h1>
    <div>${ctas}</div>
  </section>`;
  const pill = '<span className="rounded-full bg-zinc-100 px-3 py-1 text-sm">New</span>';

  it("flags the full template as error", () => {
    const [f] = runRule(HERO, hero(pill, "<button>Get Started</button><a href='/x'>Learn more</a>"));
    expect(f).toMatchObject({ severity: "error", line: 1 });
    expect(f?.message).toBe('Template hero: centered headline with pill badge and "Get Started"/"Learn more" buttons');
  });

  it("flags the partial template as warn", () => {
    const [f] = runRule(HERO, hero("", "<button>Start free trial</button><a href='/x'>Watch demo</a>"));
    expect(f?.severity).toBe("warn");
    expect(f?.message).toBe('Template hero: centered headline and "Start free trial"/"Watch demo" buttons');
  });

  it("reports only the deepest matching element", () => {
    expect(runRule(HERO, `<main className="text-center mx-auto">${hero(pill, "<button>Get started</button>")}</main>`)).toHaveLength(1);
  });

  it("ignores a left-aligned hero", () => {
    expect(runRule(HERO, hero(pill, "<button>Get Started</button>").replace("text-center items-center", "text-left"))).toHaveLength(0);
  });
});

describe("radius and shadow overuse", () => {
  it("flags rounded-3xl from the third use", () => {
    const rule = "layout-slop/rounded-3xl-overuse";
    expect(runRule(rule, '<div><a className="rounded-3xl" /><a className="rounded-3xl" /></div>')).toHaveLength(0);
    const three = runRule(rule, '<div><a className="rounded-3xl" /><a className="rounded-t-3xl" /><a className="rounded-[2rem]" /><a className="rounded-full" /></div>');
    expect(three.map((f) => f.message)).toEqual(Array(3).fill("rounded-3xl used 3x in this file"));
    expect(runRule(rule, ".a{border-radius:32px}.b{border-radius:24px}.c{border-radius:40px}.d{border-radius:50%}", "css")).toHaveLength(3);
  });

  it("flags heavy shadows on flat surfaces from the second use", () => {
    const rule = "layout-slop/heavy-shadow";
    expect(runRule(rule, '<div><a className="rounded-xl shadow-xl" /><a className="bg-white shadow-2xl" /></div>')).toHaveLength(2);
    expect(runRule(rule, '<div><a className="rounded-xl shadow-xl" /><a className="rounded-xl hover:shadow-2xl" /></div>')).toHaveLength(0);
    expect(runRule(rule, '<div><a className="fixed rounded-xl shadow-xl" /><a className="absolute bg-white shadow-2xl" /></div>')).toHaveLength(0);
  });
});
