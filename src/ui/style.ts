import { styleText } from "node:util";

type Format = Parameters<typeof styleText>[0];

export interface Style {
  enabled: boolean;
  dim(text: string): string;
  bold(text: string): string;
  accent(text: string): string;
  red(text: string): string;
}

export interface ColorEnv {
  noColorFlag: boolean;
  env: Record<string, string | undefined>;
  isTTY: boolean;
}

export function colorEnabled({ noColorFlag, env, isTTY }: ColorEnv): boolean {
  if (noColorFlag || env.NO_COLOR) return false;
  const force = env.FORCE_COLOR;
  if (force !== undefined && force !== "" && force !== "0" && force !== "false") return true;
  return isTTY && env.TERM !== "dumb";
}

export function createStyle(enabled: boolean): Style {
  const wrap =
    (format: Format) =>
    (text: string): string =>
      enabled ? styleText(format, text, { validateStream: false }) : text;
  return { enabled, dim: wrap("dim"), bold: wrap("bold"), accent: wrap("cyan"), red: wrap("red") };
}
