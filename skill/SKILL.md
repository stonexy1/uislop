---
name: uislop
description: Build and review React, Next.js, Tailwind, HTML and CSS UI without the tells of AI-generated design (purple gradients, emoji icons, cliché copy, identical icon-card grids, template heroes, fake stats and dead links). Use when asked to build, polish or review frontend UI, when a design "looks AI-generated", or before finishing any change to .tsx, .jsx, .css or .html files; verifies the result with the local slopscan CLI (no API key, under a second).
license: MIT
compatibility: Claude Code, Cursor and other Agent Skills clients. Needs Node.js 20.12+ to run `npx @stonexy/slopscan`.
allowed-tools: Bash(npx @stonexy/slopscan *)
---

# uislop: UI without the AI template look

`npx @stonexy/slopscan` is a local static analyzer. It parses .tsx, .jsx, .css and .html files, applies 20 rules in six
categories and prints a Slop Score from 0 to 100 (lower is better). It makes no network calls and uses no LLM.

## When to use

- You are about to write or change frontend UI: components, pages, Tailwind classes, CSS or static HTML.
- The user asks you to review, polish or "de-slop" a design, or says it looks generated.
- You are finishing a task that touched .tsx, .jsx, .css or .html files.

Skip it for back-end-only changes, scripts, tests and non-UI code.

## Workflow

1. Before writing, decide the system: a zinc or slate neutral scale plus one accent color, a type scale of two or
   three sizes, one border radius, and one icon set (lucide-react if installed, otherwise inline SVG).
2. While writing, avoid every pattern in the table below.
3. After writing, run `npx @stonexy/slopscan <changed paths> --json` and read `findings[]` (`file`, `line`, `ruleId`,
   `message`, `fixHint`). Humans can read the plain report: `npx @stonexy/slopscan <path>`.
4. Fix the findings with the most `points` first. Change presentation only.
5. Repeat until `npx @stonexy/slopscan <path> --ci --max-slop 15` exits 0.

`npx @stonexy/slopscan <path> --prompt` prints a ready-made fix prompt with every finding as file:line, if you prefer to work
from a checklist.

## Banned patterns and replacements

| Rule ID | Don't | Do instead |
|---|---|---|
| `color-slop/ai-gradient` | `from-indigo-500 via-purple-500 to-pink-500` backgrounds, gradient headline text | Flat `bg-zinc-50` surface and one accent; if a gradient is essential, two adjacent shades of one hue |
| `color-slop/neon-shadow` | `shadow-purple-500/50` and other colored glows | `shadow-sm`, `shadow-zinc-900/10`, or a 1px `border-zinc-200` |
| `color-slop/pure-black-white` | `bg-black text-white`, `#000` text | `bg-zinc-950`, `text-zinc-900`; keep white for light surfaces |
| `color-slop/ai-accent-palette` | indigo/violet/purple accents on every heading, link and border | One non-default accent (emerald, amber, sky or the brand color), used on primary actions |
| `emoji-ui/emoji-in-jsx` | 🚀 as a feature icon, ✨ in badges | `<Rocket className="size-5" aria-hidden />` from lucide-react, or an inline SVG |
| `copy-slop/cliche-phrase` | "Supercharge your workflow", "Unleash the power of" | "Track deploys and roll back in one click" |
| `copy-slop/placeholder-content` | Acme Corp, John Doe, Lorem ipsum, (555) numbers | Real product details or plausible, varied sample data |
| `copy-slop/buzzword-density` | "powerful, seamless, intuitive" | One concrete fact per sentence |
| `layout-slop/icon-card-grid` | Three identical cards, each with a colored icon square, heading and paragraph | Vary size and span, inline small icons, or a list or table of specifics |
| `layout-slop/identical-card-grid` | Rows of identical heading-plus-paragraph cards | One featured card spanning two columns, varied content, or a definition list |
| `layout-slop/template-hero` | Centered hero with pill badge, giant headline, "Get Started" and "Learn More" | Left-aligned copy beside the real product, one specific CTA |
| `layout-slop/rounded-3xl-overuse` | `rounded-3xl` on every surface | One radius (`rounded-lg` or `rounded-xl`); `rounded-full` only for avatars and pills |
| `layout-slop/heavy-shadow` | `shadow-xl` and `shadow-2xl` on flat cards | `shadow-sm` or a 1px border; large shadows only for popovers and modals |
| `typo-slop/missing-tabular-nums` | Prices, stats and table numbers in proportional digits | `tabular-nums` on numbers, counters, prices and table cells |
| `typo-slop/unconstrained-paragraph` | Long paragraphs running the full container width | `max-w-prose` or `max-w-2xl` on the paragraph or its wrapper |
| `fake-ui/dead-link` | `href="#"`, `javascript:void(0)` | A real route or anchor, or `<button type="button">` for actions |
| `fake-ui/noop-handler` | `onClick={() => {}}`, submit handlers that only call `preventDefault()` | Call the real function or mutation, or remove the control |
| `fake-ui/console-handler` | `onClick={() => console.log("clicked")}` | The real behavior, or remove the control |
| `fake-ui/fake-metric` | "99.9% uptime", "10,000+ happy users", "4.9/5" without a source | Real numbers from data with a source, or nothing |
| `fake-ui/placeholder-asset` | via.placeholder.com, picsum.photos, i.pravatar.cc | Real images from the project's assets or a deliberate illustration |

## Design principles

- Palette: neutrals from zinc, slate or neutral; one accent color for primary actions; never pure `#000`.
- Type: two or three sizes per view; `tabular-nums` for numbers; line length at most about 65ch via `max-w-prose`.
- Spacing on a 4px scale. One radius. 1px borders before shadows.
- Icons: lucide-react or inline SVG at 16 to 20px with `aria-hidden`.
- Copy: specific nouns and verbs, real or plausible varied data, no superlatives.
- States: design hover, focus-visible, disabled, empty, loading and error states.

## Interpreting the score

| Score | Tier |
|---|---|
| 0-15 | Bespoke Craft |
| 16-35 | Minor Slop |
| 36-60 | Template Vibe |
| 61-100 | Pure AI Slop |

Target 15 or less. In `--json` output, read `score.value`, `score.tier` and `findings[]`; each finding carries
`file`, `line`, `column`, `ruleId`, `message`, `fixHint` and `points`.

## Escape hatch

When a finding is intentional, add `// uislop-ignore <rule-id> -- reason` on the line above
(`{/* uislop-ignore <rule-id> */}` inside JSX, `/* ... */` in CSS, `<!-- ... -->` in HTML). Never add ignores just to
pass the check.

## Guardrails

- Do not change logic while restyling: props, state, handlers, data fetching, routing and types stay as they are.
- Do not delete features to make findings disappear.
- Run the project's typecheck, lint and tests after your changes.
