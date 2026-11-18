import { colorSlopRules } from "./color-slop";
import { copySlopRules } from "./copy-slop";
import { emojiUiRules } from "./emoji-ui";
import { fakeUiRules } from "./fake-ui";
import { layoutSlopRules } from "./layout-slop";
import { typoSlopRules } from "./typo-slop";
import type { Category, Rule } from "../types";

export const CATEGORIES: Category[] = ["color-slop", "emoji-ui", "copy-slop", "layout-slop", "typo-slop", "fake-ui"];

export const ALL_RULES: Rule[] = [
  ...colorSlopRules,
  ...emojiUiRules,
  ...copySlopRules,
  ...layoutSlopRules,
  ...typoSlopRules,
  ...fakeUiRules,
];

const KNOWN_IDS = new Set<string>([...CATEGORIES, ...ALL_RULES.map((r) => r.id)]);

export function isKnownRuleId(id: string): boolean {
  return KNOWN_IDS.has(id);
}

export function ruleById(id: string): Rule | undefined {
  return ALL_RULES.find((r) => r.id === id);
}
