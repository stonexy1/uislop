import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { renderBadge } from "./badge";
import { runInit } from "./commands/init";
import { UsageError } from "./errors";
import { BIN_ALIAS, BIN_NAME, CONFIG_FILE, DEFAULT_MAX_SLOP, IGNORE_KEYWORD, NPX, TARGET_SLOP, VERSION } from "./meta";
import { buildPrompt } from "./prompt-builder";
import { renderJson, renderQuiet, renderReport, type CiOutcome } from "./report";
import { runScan } from "./scan";
import { colorEnabled, createStyle } from "./ui/style";

export interface CliIO {
  stdout(text: string): void;
  stderr(text: string): void;
  cwd: string;
  env: Record<string, string | undefined>;
  isTTY: boolean;
  columns: number | undefined;
}

const DEFAULT_BADGE = "uislop-badge.svg";

const HELP = `Usage:
  ${BIN_NAME} [path...] [options]     scan .tsx, .jsx, .css and .html files (default ".")
  ${BIN_NAME} init [options]          install the agent skill into .claude/skills

Scan options:
  --prompt                 print only the fix prompt (pipe it into an agent)
  --json                   print the full result as JSON
  -q, --quiet              print only the score line
  --badge [file.svg]       write an SVG badge (default ./${DEFAULT_BADGE})
  --ci                     exit 1 when the score is above the threshold
  --max-slop <0-100>       threshold for --ci (implies --ci; default ${DEFAULT_MAX_SLOP})
  --max-file-slop <0-100>  also fail when a single file scores above this
  --config <path>          use this config file instead of ./${CONFIG_FILE}
  --all                    show every finding
  --no-fix-prompt          omit the fix prompt block from the report
  --no-color               disable colors

Init options:
  --cursor                 also write .cursor/skills
  --agents                 also write .agents/skills
  --all                    write all three locations
  --force                  overwrite files that differ from the bundled skill
  --dir <path>             target project directory (default ".")

Tiers: 0-15 Bespoke Craft, 16-35 Minor Slop, 36-60 Template Vibe, 61-100 Pure AI Slop.
Suppress a finding with a "// ${IGNORE_KEYWORD} <rule-id>" comment on the line above.
Fix target for agents: ${NPX} <path> --ci --max-slop ${TARGET_SLOP}. "${BIN_ALIAS}" is an alias of "${BIN_NAME}".
`;

const OPTIONS = {
  prompt: { type: "boolean" },
  json: { type: "boolean" },
  quiet: { type: "boolean", short: "q" },
  "no-color": { type: "boolean" },
  badge: { type: "boolean" },
  "badge-file": { type: "string" },
  ci: { type: "boolean" },
  "max-slop": { type: "string" },
  "max-file-slop": { type: "string" },
  config: { type: "string" },
  all: { type: "boolean" },
  "no-fix-prompt": { type: "boolean" },
  cursor: { type: "boolean" },
  agents: { type: "boolean" },
  force: { type: "boolean" },
  dir: { type: "string" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
} as const;

export function normalizeBadgeArgs(argv: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    const next = argv[i + 1];
    if (arg === "--badge" && next !== undefined && /\.svg$/i.test(next)) {
      out.push(`--badge-file=${next}`);
      i++;
    } else if (arg.startsWith("--badge=")) {
      out.push(`--badge-file=${arg.slice("--badge=".length)}`);
    } else {
      out.push(arg);
    }
  }
  return out;
}

function threshold(value: string | undefined, flag: string): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  if (!/^\d+$/.test(value) || n > 100) throw new UsageError(`${flag} expects an integer from 0 to 100, got "${value}"`);
  return n;
}

function defaultIO(): CliIO {
  return {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    cwd: process.cwd(),
    env: process.env,
    isTTY: Boolean(process.stdout.isTTY),
    columns: process.stdout.columns,
  };
}

function parse(argv: string[]) {
  try {
    return parseArgs({ args: normalizeBadgeArgs(argv), options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
}

function execute(argv: string[], io: CliIO): number {
  const { values, positionals } = parse(argv);
  if (values.help) {
    io.stdout(HELP);
    return 0;
  }
  if (values.version) {
    io.stdout(`${VERSION}\n`);
    return 0;
  }
  if (positionals[0] === "init") {
    if (positionals.length > 1) throw new UsageError(`init takes no positional arguments, got "${positionals[1]}"`);
    const result = runInit({
      dir: resolve(io.cwd, values.dir ?? "."),
      cursor: Boolean(values.cursor),
      agents: Boolean(values.agents),
      all: Boolean(values.all),
      force: Boolean(values.force),
    });
    io.stdout(`${result.lines.join("\n")}\n`);
    return result.exitCode;
  }

  const maxSlopFlag = threshold(values["max-slop"], "--max-slop");
  const maxFileSlopFlag = threshold(values["max-file-slop"], "--max-file-slop");
  const ciActive = Boolean(values.ci) || maxSlopFlag !== null || maxFileSlopFlag !== null;
  const scanArgs: Parameters<typeof runScan>[0] = { paths: positionals, cwd: io.cwd };
  if (values.config) scanArgs.configPath = values.config;
  const { result, config } = runScan(scanArgs);
  const displayPath = positionals.length > 0 ? positionals.join(" ") : ".";

  for (const warning of result.warnings) {
    io.stderr(`warning: ${warning.file ? `${warning.file}: ` : ""}${warning.message}\n`);
  }

  let ci: CiOutcome | null = null;
  if (ciActive) {
    const limit = maxSlopFlag ?? config.maxSlop ?? DEFAULT_MAX_SLOP;
    const maxFileSlop = maxFileSlopFlag ?? config.maxFileSlop;
    const failingFile = maxFileSlop === null ? null : (result.score.files.find((f) => f.score > maxFileSlop) ?? null);
    ci = { threshold: limit, maxFileSlop, failingFile, passed: result.score.score <= limit && failingFile === null };
  }

  const machineOutput = Boolean(values.json || values.prompt);
  const badgeTarget = values["badge-file"] ?? (values.badge ? DEFAULT_BADGE : undefined);
  if (badgeTarget !== undefined) {
    const abs = resolve(io.cwd, badgeTarget);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, renderBadge(result.score.score, result.score.tierLabel));
    const shown = relative(io.cwd, abs);
    const note = `Badge written to ${shown && !shown.startsWith("..") ? shown : abs}\n`;
    if (machineOutput) io.stderr(note);
    else io.stdout(note);
  }

  const prompt = () => buildPrompt(result, { path: displayPath });
  if (values.json) {
    io.stdout(renderJson(result, { maxSlop: ci ? ci.threshold : null, passed: ci ? ci.passed : null }));
  } else if (values.prompt) {
    if (result.findings.length === 0) io.stderr("No findings; there is nothing to fix.\n");
    else io.stdout(`${prompt()}\n`);
  } else if (values.quiet) {
    io.stdout(renderQuiet(result));
  } else {
    const style = createStyle(colorEnabled({ noColorFlag: Boolean(values["no-color"]), env: io.env, isTTY: io.isTTY }));
    const showPrompt = !values["no-fix-prompt"] && result.findings.length > 0 && result.score.score > TARGET_SLOP;
    io.stdout(
      renderReport(result, {
        style,
        displayPath,
        columns: io.columns,
        all: Boolean(values.all),
        fixPrompt: showPrompt ? prompt() : null,
        ci,
      }),
    );
  }
  return ci && !ci.passed ? 1 : 0;
}

export async function runCli(argv: string[], io: Partial<CliIO> = {}): Promise<number> {
  const resolved: CliIO = { ...defaultIO(), ...io };
  try {
    return execute(argv, resolved);
  } catch (error) {
    if (error instanceof UsageError) {
      resolved.stderr(`error: ${error.message}\n`);
      return error.exitCode;
    }
    resolved.stderr(`internal error: ${(error as Error).stack ?? String(error)}\n`);
    return 3;
  }
}
