import { describe, expect, it } from "vitest";
import { parseToken } from "../../src/parse/classes";
import { parsed } from "../helpers";

const table: [string, string[], boolean, boolean, string, string | undefined, string | undefined][] = [
  ["hover:bg-black/50", ["hover"], false, false, "bg-black", "50", undefined],
  ["!text-red-500", [], true, false, "text-red-500", undefined, undefined],
  ["text-red-500!", [], true, false, "text-red-500", undefined, undefined],
  ["dark:md:hover:shadow-purple-500/50", ["dark", "md", "hover"], false, false, "shadow-purple-500", "50", undefined],
  ["bg-[#6366f1]", [], false, false, "bg-[#6366f1]", undefined, "#6366f1"],
  ["bg-[url(https://x.y/a.png)]", [], false, false, "bg-[url(https://x.y/a.png)]", undefined, "url(https://x.y/a.png)"],
  ["[&>svg]:size-4", ["[&>svg]"], false, false, "size-4", undefined, undefined],
  ["data-[state=open]:bg-white", ["data-[state=open]"], false, false, "bg-white", undefined, undefined],
  ["-mt-2", [], false, true, "mt-2", undefined, undefined],
  ["w-1/2", [], false, false, "w-1", "2", undefined],
  ["bg-black/[.04]", [], false, false, "bg-black", "[.04]", undefined],
  ["group-hover/item:opacity-100", ["group-hover/item"], false, false, "opacity-100", undefined, undefined],
  ["bg-(--brand)", [], false, false, "bg-(--brand)", undefined, "--brand"],
];

describe("parseToken", () => {
  it.each(table)("%s", (raw, variants, important, negative, core, modifier, arbitrary) => {
    const token = parseToken(raw);
    expect(token.variants).toEqual(variants);
    expect(token.important).toBe(important);
    expect(token.negative).toBe(negative);
    expect(token.core).toBe(core);
    expect(token.modifier).toBe(modifier);
    expect(token.arbitrary).toBe(arbitrary);
  });

  it("drops partial tokens around template expressions", () => {
    const file = parsed("const x = <div className={`bg-${c}-500 p-4`} />;");
    expect(file.classTokens.map((t) => t.raw)).toEqual(["p-4"]);
  });
});
