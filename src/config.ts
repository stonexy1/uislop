import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { UsageError } from "./errors";
import { CONFIG_FILE } from "./meta";
import { ALL_RULES, CATEGORIES } from "./rules/index";
import type { Rule, RuleOptions, RuleSetting, Severity, UislopConfig } from "./types";

export const DEFAULT_CLASS_FUNCTIONS = ["cn", "clsx", "cx", "classnames", "classNames", "twMerge", "twJoin", "cva", "tv", "tw"];

const SEVERITIES = new Set(["error", "warn", "info"]);
const TOP_LEVEL_KEYS = new Set([
  "include",
  "exclude",
  "useDefaultExcludes",
  "rules",
  "maxSlop",
  "maxFileSlop",
  "ignore",
  "ignoreText",
  "classFunctions",
  "maxFileSize",
]);

export function defaultConfig(): UislopConfig {
  return {
    include: ["**"],
    exclude: [],
    useDefaultExcludes: true,
    rules: {},
    maxSlop: null,
    maxFileSlop: null,
    ignore: [],
    ignoreText: [],
    classFunctions: [...DEFAULT_CLASS_FUNCTIONS],
    maxFileSize: 1_000_000,
  };
}

export interface LoadedConfig {
  config: UislopConfig;
  path: string | null;
  warnings: string[];
}

export function discoverConfig(root: string): string | null {
  let dir = resolve(root);
  for (;;) {
    const candidate = join(dir, CONFIG_FILE);
    if (existsSync(candidate)) return candidate;
    if (existsSync(join(dir, "package.json"))) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadConfig(root: string, explicitPath?: string): LoadedConfig {
  const path = explicitPath ? resolve(explicitPath) : discoverConfig(root);
  if (!path) return { config: defaultConfig(), path: null, warnings: [] };
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new UsageError(`Cannot read config file ${path}`);
  }
  const { config, warnings } = parseConfig(text, basename(path));
  return { config, path, warnings };
}

function lineCol(text: string, position: number): string {
  const before = text.slice(0, position).split("\n");
  return `${before.length}:${(before[before.length - 1] ?? "").length + 1}`;
}

function jsonErrorOffset(text: string): number {
  let i = 0;
  const fail = (): never => {
    throw i;
  };
  const ws = () => {
    while (i < text.length && /\s/.test(text[i] as string)) i++;
  };
  const string = () => {
    i++;
    while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    if (i >= text.length) fail();
    i++;
  };
  const value = (): void => {
    ws();
    const c = text[i];
    if (c === "{" || c === "[") {
      const close = c === "{" ? "}" : "]";
      i++;
      ws();
      if (text[i] === close) {
        i++;
        return;
      }
      for (;;) {
        if (c === "{") {
          ws();
          if (text[i] !== '"') fail();
          string();
          ws();
          if (text[i] !== ":") fail();
          i++;
        }
        value();
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === close) {
          i++;
          return;
        }
        fail();
      }
    }
    if (c === '"') return string();
    const literal = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i));
    if (!literal) fail();
    i += (literal as RegExpExecArray)[0].length;
  };
  try {
    value();
    ws();
    if (i < text.length) fail();
  } catch (offset) {
    return offset as number;
  }
  return text.length;
}

function parseJson(text: string, name: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const reason = (error as Error).message.replace(/\s*in JSON at position.*$/s, "").replace(/,\s*".*$/s, "");
    throw new UsageError(`${name}: ${reason} at line ${lineCol(text, jsonErrorOffset(text))}`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, path: string, name: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new UsageError(`${name}: ${path}: expected an array of strings`);
  }
  return value as string[];
}

function threshold(value: unknown, path: string, name: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new UsageError(`${name}: ${path}: expected an integer from 0 to 100`);
  }
  return value;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0] as number;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j] as number;
      row[j] = Math.min(current + 1, (row[j - 1] as number) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = current;
    }
  }
  return row[b.length] as number;
}

export function suggestRuleKey(key: string): string | null {
  const known = [...CATEGORIES, ...ALL_RULES.map((r) => r.id)];
  const tail = key.split("/").pop() ?? key;
  const byTail = ALL_RULES.find((r) => r.id.endsWith(`/${tail}`));
  if (byTail) return byTail.id;
  let best: string | null = null;
  let bestDistance = 3;
  for (const candidate of known) {
    const distance = editDistance(key, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function knownOptions(key: string): Set<string> {
  const rules = ALL_RULES.filter((r) => r.id === key || r.category === key);
  return new Set(rules.flatMap((r) => Object.keys(r.defaultOptions ?? {})));
}

function ruleSetting(value: unknown, key: string, name: string, warnings: string[]): RuleSetting {
  const expected = `${name}: rules.${key}: expected "off"|"error"|"warn"|"info"|{ severity, weight, options }`;
  if (typeof value === "string") {
    if (value === "off" || SEVERITIES.has(value)) return value as RuleSetting;
    throw new UsageError(expected);
  }
  if (!isObject(value)) throw new UsageError(expected);
  const setting: { severity?: Severity | "off"; weight?: number; options?: RuleOptions } = {};
  for (const [field, fieldValue] of Object.entries(value)) {
    if (field === "severity") {
      if (typeof fieldValue !== "string" || (fieldValue !== "off" && !SEVERITIES.has(fieldValue))) {
        throw new UsageError(`${name}: rules.${key}.severity: expected "off"|"error"|"warn"|"info"`);
      }
      setting.severity = fieldValue as Severity | "off";
    } else if (field === "weight") {
      if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue) || fieldValue < 0) {
        throw new UsageError(`${name}: rules.${key}.weight: expected a non-negative number`);
      }
      setting.weight = fieldValue;
    } else if (field === "options") {
      if (!isObject(fieldValue)) throw new UsageError(`${name}: rules.${key}.options: expected an object`);
      const allowed = knownOptions(key);
      const options: RuleOptions = {};
      for (const [option, optionValue] of Object.entries(fieldValue)) {
        if (!["number", "string", "boolean"].includes(typeof optionValue)) {
          throw new UsageError(`${name}: rules.${key}.options.${option}: expected a number, string or boolean`);
        }
        if (!allowed.has(option)) warnings.push(`${name}: rules.${key}.options.${option}: unknown option, ignored`);
        else options[option] = optionValue as number | string | boolean;
      }
      setting.options = options;
    } else {
      warnings.push(`${name}: rules.${key}.${field}: unknown key, ignored`);
    }
  }
  return setting;
}

export function parseConfig(text: string, name: string = CONFIG_FILE): { config: UislopConfig; warnings: string[] } {
  const data = parseJson(text.replace(/^﻿/, ""), name);
  if (!isObject(data)) throw new UsageError(`${name}: expected a JSON object`);
  const config = defaultConfig();
  const warnings: string[] = [];
  const ruleKeys = new Set<string>([...CATEGORIES, ...ALL_RULES.map((r) => r.id)]);

  for (const [key, value] of Object.entries(data)) {
    switch (key) {
      case "include":
        config.include = stringArray(value, key, name);
        break;
      case "exclude":
        config.exclude = stringArray(value, key, name);
        break;
      case "classFunctions":
        config.classFunctions = [...DEFAULT_CLASS_FUNCTIONS, ...stringArray(value, key, name)];
        break;
      case "ignoreText":
        config.ignoreText = stringArray(value, key, name);
        break;
      case "useDefaultExcludes":
        if (typeof value !== "boolean") throw new UsageError(`${name}: useDefaultExcludes: expected a boolean`);
        config.useDefaultExcludes = value;
        break;
      case "maxSlop":
        config.maxSlop = threshold(value, key, name);
        break;
      case "maxFileSlop":
        config.maxFileSlop = threshold(value, key, name);
        break;
      case "maxFileSize":
        if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
          throw new UsageError(`${name}: maxFileSize: expected a positive integer (bytes)`);
        }
        config.maxFileSize = value;
        break;
      case "rules": {
        if (!isObject(value)) throw new UsageError(`${name}: rules: expected an object`);
        for (const [ruleKey, setting] of Object.entries(value)) {
          if (!ruleKeys.has(ruleKey)) {
            const suggestion = suggestRuleKey(ruleKey);
            warnings.push(
              `${name}: rules.${ruleKey}: unknown rule, ignored${suggestion ? ` (did you mean "${suggestion}"?)` : ""}`,
            );
            continue;
          }
          config.rules[ruleKey] = ruleSetting(setting, ruleKey, name, warnings);
        }
        break;
      }
      case "ignore": {
        if (!Array.isArray(value)) throw new UsageError(`${name}: ignore: expected an array`);
        config.ignore = value.map((item, i) => {
          if (!isObject(item)) throw new UsageError(`${name}: ignore[${i}]: expected { files, rules? }`);
          const files = stringArray(item.files, `ignore[${i}].files`, name);
          const rules = item.rules === undefined ? undefined : stringArray(item.rules, `ignore[${i}].rules`, name);
          return rules ? { files, rules } : { files };
        });
        break;
      }
      default:
        if (!TOP_LEVEL_KEYS.has(key)) warnings.push(`${name}: ${key}: unknown key, ignored`);
    }
  }
  return { config, warnings };
}

export interface ResolvedRule {
  severity: Severity;
  severityOverride: boolean;
  weight: number;
  options: RuleOptions;
}

export function resolveRule(rule: Rule, config: UislopConfig): ResolvedRule | null {
  const setting = config.rules[rule.id] ?? config.rules[rule.category];
  const base: ResolvedRule = {
    severity: rule.defaultSeverity,
    severityOverride: false,
    weight: rule.weight,
    options: { ...rule.defaultOptions },
  };
  if (setting === undefined) return base;
  if (setting === "off") return null;
  if (typeof setting === "string") return { ...base, severity: setting, severityOverride: true };
  if (setting.severity === "off") return null;
  return {
    severity: setting.severity ?? base.severity,
    severityOverride: setting.severity !== undefined,
    weight: setting.weight ?? base.weight,
    options: { ...base.options, ...setting.options },
  };
}
