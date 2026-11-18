# uislop

`slopscan` scores how much a frontend codebase looks AI-generated. It parses .tsx, .jsx, .css and .html files,
applies 20 rules in six categories and reports a Slop Score from 0 to 100, with the file and line of every finding.

- Local and deterministic: no LLM, no API key, no network calls. A 300-file, 62,000-line test corpus scans in about 0.75 s including Node startup.
- AST-based for JSX/TSX (Babel parser): reads `className`, `cn()`, `clsx()`, `cva()`, template literals and `@apply`.
- Writes a fix prompt for Claude Code or Cursor, an SVG badge, and installs an agent skill.
- One runtime dependency (`@babel/parser`). Node.js 20.12 or newer.

```sh
npx slopscan            # scan the current directory
npx slopscan src        # scan a folder or file
```

The package installs two equivalent commands: `slopscan` and `uislop`. Examples below use `npx slopscan`.

## Output

```
uislop 0.1.0  src · 4 files · 124 UI elements

src/Landing.tsx  71 findings · score 99
  15:7     error  layout-slop/template-hero        Template hero: centered headline with pill badge…
  15:45    error  color-slop/ai-gradient           Gradient from-indigo-500 via-purple-500 to-pink-…
  38:9     error  layout-slop/icon-card-grid       3 identical feature cards (icon tile, heading, p…
  … 59 more in this file (run with --all)

Category        Findings  Points
copy-slop             30      23
fake-ui               26      23
color-slop            15      18
emoji-ui              15      16
layout-slop           20      13
typo-slop             12       5

Slop Score  98/100  Pure AI Slop
Worst file  src/Landing.tsx (99)
Done in 47 ms
```

When the score is above 15, the report ends with a fix prompt block.

## Score and tiers

| Score | Tier |
|---|---|
| 0-15 | Bespoke Craft |
| 16-35 | Minor Slop |
| 36-60 | Template Vibe |
| 61-100 | Pure AI Slop |

Each finding is worth `weight x severity multiplier` points (error 1.5, warn 1.0, info 0.5). The points are divided
by the number of UI units (JSX/HTML elements plus CSS rule blocks, at least 50), and the result is mapped to 0-100
with `score = round(100 x (1 - e^(-2 x density)))`. More findings never lower the score, and a large codebase with a
few findings stays near 0. Per-file scores use the same formula; `--max-file-slop` gates on them.

## Rules

| Rule ID | Weight | Default | Flags |
|---|---|---|---|
| `color-slop/ai-gradient` | 3 | warn, error for 2+ purple/indigo/pink stops | `from-indigo-500 via-purple-500 to-pink-500`, CSS `linear-gradient` in the same hues |
| `color-slop/neon-shadow` | 2 | warn | `shadow-purple-500/50`, colored glow `box-shadow` |
| `color-slop/pure-black-white` | 1.5 | warn | `bg-black`, `text-black`, `#000` (not in `dark:` variants) |
| `color-slop/ai-accent-palette` | 1 | info | 5+ indigo/violet/purple/fuchsia/pink accent classes in one file |
| `emoji-ui/emoji-in-jsx` | 2 | warn, error when used as an icon | Emoji in visible text, attributes and CSS `content` |
| `copy-slop/cliche-phrase` | 2 | warn | Stock phrases such as "supercharge", "unleash the power", "next-generation" |
| `copy-slop/placeholder-content` | 2 | warn | "Acme Corp", "John Doe", "Lorem ipsum", `(555)` numbers, `@example.com` |
| `copy-slop/buzzword-density` | 1 | info | Two or more buzzwords in one text, such as "powerful, seamless, intuitive" |
| `layout-slop/icon-card-grid` | 3 | error | 3+ identical cards with an icon tile, heading and paragraph in a grid |
| `layout-slop/identical-card-grid` | 2 | warn | 3+ identical heading-plus-paragraph cards in a grid |
| `layout-slop/template-hero` | 3 | error, warn without the pill | Centered hero, pill badge, `text-6xl` headline, "Get Started" / "Learn More" |
| `layout-slop/rounded-3xl-overuse` | 1 | warn | `rounded-3xl` or a 24px+ radius used 3+ times in a file |
| `layout-slop/heavy-shadow` | 1 | warn | `shadow-xl` / `shadow-2xl` on flat surfaces, 2+ times in a file |
| `typo-slop/missing-tabular-nums` | 1 | warn, info for dynamic values | Numbers, prices and table cells without `tabular-nums` |
| `typo-slop/unconstrained-paragraph` | 1 | warn | Paragraphs of 160+ characters with no `max-w-*` or `prose` |
| `fake-ui/dead-link` | 2 | warn | `href="#"`, `javascript:void(0)` |
| `fake-ui/noop-handler` | 2 | warn | `onClick={() => {}}`, submit handlers that only call `preventDefault()` |
| `fake-ui/console-handler` | 2 | warn | Handlers that only call `console.log` or `alert` |
| `fake-ui/fake-metric` | 3 | warn | Static "99.9% uptime", "10,000+ users", "4.9/5" |
| `fake-ui/placeholder-asset` | 1.5 | warn | via.placeholder.com, picsum.photos, i.pravatar.cc and similar hosts |

Rule options: `rounded-3xl-overuse.minCount` (3), `heavy-shadow.minCount` (2), `unconstrained-paragraph.minChars`
(160), `icon-card-grid.minSiblings` and `identical-card-grid.minSiblings` (3), `ai-accent-palette.minUses` (5),
`buzzword-density.minDistinct` (2).

## Commands and flags

```
npx slopscan [path...] [options]
npx slopscan init [--cursor] [--agents] [--all] [--force] [--dir <path>]
```

| Flag | Effect |
|---|---|
| `--prompt` | Print only the fix prompt to stdout |
| `--json` | Print the full result as JSON (`schemaVersion: 1`) |
| `-q`, `--quiet` | Print only `98/100 Pure AI Slop` |
| `--badge [file.svg]` | Write an SVG badge (default `./uislop-badge.svg`) |
| `--ci` | Exit 1 when the score is above the threshold (default 35) |
| `--max-slop <n>` | Threshold for `--ci`; implies `--ci` |
| `--max-file-slop <n>` | Also fail when any single file scores above `n` |
| `--config <path>` | Use a specific config file |
| `--all` | Show every finding instead of 12 per file |
| `--no-fix-prompt` | Omit the fix prompt block |
| `--no-color` | Disable colors (`NO_COLOR` and `FORCE_COLOR` are honored too) |

Exit codes: 0 success or CI pass, 1 CI threshold exceeded (or `init` skipped a differing file), 2 usage or config
error, 3 internal error.

## Fix prompts

```sh
npx slopscan src --prompt | pbcopy
```

The prompt lists up to 30 findings by impact, grouped by file with `L<line>:<column>`, adds design direction for the
categories that fired, forbids logic changes, and ends with a verification step:
`npx slopscan src --ci --max-slop 15` until it exits 0.

## Agent skill

```sh
npx slopscan init              # writes .claude/skills/uislop/SKILL.md
npx slopscan init --all        # also .cursor/skills and .agents/skills
```

`init` never overwrites a file that differs from the bundled skill unless you pass `--force`. The skill is also
published in this repository under `skill/`, so `npx skills add <owner>/<repo>` works too. It tells the agent which
patterns to avoid and to verify its work with `npx slopscan <path> --ci --max-slop 15`.

## Badge

```sh
npx slopscan --badge
```

```md
![UI Slop](./uislop-badge.svg)
```

The badge reads `UI Slop | 8/100 · Bespoke Craft`, colored by tier.

## CI

```yaml
- run: npx slopscan --ci --max-slop 20
```

## Configuration

`uislop.config.json` is read from the scan root or the nearest parent up to the directory that holds
`package.json`. All keys are optional.

```json
{
  "include": ["**"],
  "exclude": ["src/legacy/**"],
  "rules": {
    "emoji-ui": "off",
    "layout-slop/heavy-shadow": "info",
    "copy-slop/cliche-phrase": { "severity": "error", "weight": 3 },
    "layout-slop/rounded-3xl-overuse": { "options": { "minCount": 5 } }
  },
  "maxSlop": 20,
  "maxFileSlop": null,
  "ignore": [{ "files": ["src/marketing/**"], "rules": ["copy-slop"] }],
  "ignoreText": ["Acme"],
  "classFunctions": ["cx2"],
  "maxFileSize": 1000000
}
```

- `rules` keys are rule IDs or categories; values are `"off"`, a severity, or `{ severity, weight, options }`.
- `exclude` and `classFunctions` extend the defaults. Default excludes: test, spec and story files, `__tests__`,
  `__mocks__`, minified files. `node_modules`, `dist`, `build`, `out`, `coverage` and dot-directories are always
  skipped.
- `ignoreText` drops findings whose source line contains one of the strings (case-insensitive).
- Command-line `--max-slop` and `--max-file-slop` override the config.

## Ignore comments

```tsx
// uislop-ignore color-slop/ai-gradient -- brand gradient, approved by design
<div className="bg-gradient-to-r from-violet-600 to-indigo-600" />

{/* uislop-ignore emoji-ui */}
<span>🎉</span>
```

- `uislop-ignore` on its own line applies to the next line; after code on the same line it applies to that line.
- `uislop-ignore-next-line`, `uislop-ignore-line` and `uislop-ignore-file` are explicit forms.
- List rule IDs or categories after the keyword; with none, all rules are ignored. Text after `--` is a reason.
- A comment above a multi-line tag covers findings inside that tag. CSS uses `/* */`, HTML uses `<!-- -->`.

## Limits

- Heuristic by design: purple brand colors, emoji in chat UIs or a parent component's `max-w-*` in another file can
  produce false positives. Use ignore comments or the config.
- Tailwind class prefixes and custom theme colors are not resolved.
- Vue and Svelte files are not scanned.
- Directory names `build`, `out` and `dist` are skipped at any depth unless passed as the scan path.
- An unrelated npm package named `uislop` exists. This project is published as `slopscan`.

## Development

```sh
npm install
npm run typecheck
npm run build
npm test
```

Building and testing need Node.js 22.18 or newer; the published `dist` runs on Node.js 20.12 or newer.

## License

MIT
