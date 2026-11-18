import { textWidth } from "./badge-widths";
import { tierFor } from "./scorer";
import type { TierId } from "./types";

const LABEL = "UI Slop";
const LABEL_COLOR = "#555";
const PADDING = 10;
const TIER_COLORS: Record<TierId, string> = {
  "bespoke-craft": "#4c1",
  "minor-slop": "#dfb317",
  "template-vibe": "#fe7d37",
  "pure-ai-slop": "#e05d44",
};

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] as string);
}

export function renderBadge(score: number, tierLabel: string): string {
  const value = `${score}/100 · ${tierLabel}`;
  const labelText = textWidth(LABEL);
  const valueText = textWidth(value);
  const l = Math.ceil(labelText + PADDING);
  const v = Math.ceil(valueText + PADDING);
  const t = l + v;
  const color = TIER_COLORS[tierFor(score).id];
  const title = escapeXml(`${LABEL}: ${value}`);
  const label = escapeXml(LABEL);
  const message = escapeXml(value);
  const labelLength = Math.round(labelText * 10);
  const valueLength = Math.round(valueText * 10);
  const labelX = Math.round(l * 5);
  const valueX = Math.round((l + v / 2) * 10);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="20" role="img" aria-label="${title}">`,
    ` <title>${title}</title>`,
    ` <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`,
    ` <clipPath id="r"><rect width="${t}" height="20" rx="3" fill="#fff"/></clipPath>`,
    ` <g clip-path="url(#r)"><rect width="${l}" height="20" fill="${LABEL_COLOR}"/><rect x="${l}" width="${v}" height="20" fill="${color}"/><rect width="${t}" height="20" fill="url(#s)"/></g>`,
    ` <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">`,
    `  <text aria-hidden="true" x="${labelX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${labelLength}">${label}</text>`,
    `  <text x="${labelX}" y="140" transform="scale(.1)" fill="#fff" textLength="${labelLength}">${label}</text>`,
    `  <text aria-hidden="true" x="${valueX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${valueLength}">${message}</text>`,
    `  <text x="${valueX}" y="140" transform="scale(.1)" fill="#fff" textLength="${valueLength}">${message}</text>`,
    ` </g></svg>`,
    "",
  ].join("\n");
}
