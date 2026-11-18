# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-18

### Added

- `slopscan [path]`: scans .tsx, .jsx, .css and .html files and reports a Slop Score from 0 to 100 in four tiers.
- 20 rules in six categories: `color-slop`, `emoji-ui`, `copy-slop`, `layout-slop`, `typo-slop`, `fake-ui`.
- `--prompt` and the report's fix prompt block for Claude Code and Cursor, with file and line references.
- `init`: installs the `uislop` agent skill into `.claude/skills`, and optionally `.cursor/skills` and `.agents/skills`.
- `--badge`, `--json`, `--quiet`, `--ci`, `--max-slop`, `--max-file-slop`.
- `uislop.config.json` and `uislop-ignore` comments for TSX, JSX, CSS and HTML.
- Commands `slopscan` and `uislop`; public API in `slopscan` for programmatic use.

[0.1.0]: https://github.com/stonexy1/uislop/releases/tag/v0.1.0
