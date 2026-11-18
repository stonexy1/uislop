import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { findPackageRoot } from "../package-root";
import { NPX, SKILL_NAME } from "../meta";

export interface InitOptions {
  dir: string;
  cursor: boolean;
  agents: boolean;
  all: boolean;
  force: boolean;
}

export interface InitResult {
  lines: string[];
  exitCode: number;
}

export function bundledSkill(): string {
  const source = readFileSync(join(findPackageRoot(), "skill", "SKILL.md"), "utf8");
  return source.replace(/npx slopscan\b/g, NPX);
}

export function initTargets(options: Pick<InitOptions, "cursor" | "agents" | "all">): string[] {
  const roots = [".claude"];
  if (options.cursor || options.all) roots.push(".cursor");
  if (options.agents || options.all) roots.push(".agents");
  return roots.map((root) => `${root}/skills/${SKILL_NAME}/SKILL.md`);
}

export function runInit(options: InitOptions): InitResult {
  const content = bundledSkill();
  const base = resolve(options.dir);
  const lines: string[] = [];
  let exitCode = 0;
  for (const target of initTargets(options)) {
    const abs = join(base, target);
    if (existsSync(abs)) {
      const current = readFileSync(abs, "utf8");
      if (current === content) {
        lines.push(`unchanged ${target}`);
        continue;
      }
      if (!options.force) {
        lines.push(`skipped   ${target} (differs from bundled version; use --force to overwrite)`);
        exitCode = 1;
        continue;
      }
      writeFileSync(abs, content);
      lines.push(`updated   ${target}`);
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    lines.push(`created   ${target}`);
  }
  lines.push(`Next: ask your agent to use the "${SKILL_NAME}" skill, or run ${NPX}`);
  return { lines, exitCode };
}
