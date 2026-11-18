export type FileKind = "tsx" | "jsx" | "css" | "html";
export type Severity = "error" | "warn" | "info";
export type Category = "color-slop" | "emoji-ui" | "copy-slop" | "layout-slop" | "typo-slop" | "fake-ui";

export interface FileEntry {
  abs: string;
  rel: string;
  kind: FileKind;
  size: number;
}

export interface Pos {
  offset: number;
  line: number;
  column: number;
}

export interface LineIndex {
  pos(offset: number): Pos;
  lineText(line: number): string;
  lineCount: number;
}

export interface ClassToken {
  raw: string;
  variants: string[];
  important: boolean;
  negative: boolean;
  utility: string;
  core: string;
  modifier?: string;
  arbitrary?: string;
  line: number;
  column: number;
  offset: number;
  origin: "attr" | "call" | "template" | "apply" | "heuristic" | "html";
  group: number;
  owner?: ElementNode;
}

export type HandlerKind = "empty" | "noop-ident" | "console" | "alert" | "preventdefault-only" | "other";

export interface AttrInfo {
  name: string;
  line: number;
  column: number;
  kind: "string" | "expr" | "bool" | "none";
  value: string | null;
  handler?: HandlerKind;
}

export interface DynamicNumeric {
  line: number;
  column: number;
  text: string;
}

export interface ElementNode {
  id: number;
  tag: string;
  isComponent: boolean;
  line: number;
  column: number;
  offset: number;
  endOffset: number;
  depth: number;
  parent: ElementNode | null;
  children: ElementNode[];
  attrs: Map<string, AttrInfo>;
  classTokens: ClassToken[];
  texts: TextNode[];
  hasDynamicChild: boolean;
  dynamicNumeric?: DynamicNumeric;
  repeated?: { source: "map"; count: number | null };
}

export interface TextNode {
  text: string;
  line: number;
  column: number;
  offset: number;
  origin: "jsx-text" | "jsx-expr" | "attr" | "prop" | "html-text";
  attrName?: string;
  element: ElementNode | null;
}

export interface CssDecl {
  prop: string;
  value: string;
  line: number;
  column: number;
  offset: number;
  selector: string;
  atRule: string | null;
  blockId: number;
}

export interface Directive {
  kind: "next-line" | "line" | "file";
  rules: string[] | "all";
  targetLine: number | null;
  commentLine: number;
}

export interface ParsedFile {
  entry: FileEntry;
  source: string;
  kind: FileKind;
  lines: LineIndex;
  parseMode: "ok" | "recovered" | "fallback" | "skipped";
  warnings: string[];
  units: number;
  classTokens: ClassToken[];
  texts: TextNode[];
  elements: ElementNode[];
  allElements: ElementNode[];
  decls: CssDecl[];
  constArrays: Map<string, number>;
  isTailwindish: boolean;
  directives: Directive[];
}

export interface Finding {
  ruleId: string;
  category: Category;
  severity: Severity;
  message: string;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  snippet: string;
  fixHint: string;
  points: number;
  anchorLine?: number;
}

export type RuleOptions = Record<string, number | string | boolean>;

export interface RuleMeta {
  id: string;
  category: Category;
  weight: number;
  defaultSeverity: Severity;
  summary: string;
}

export interface Rule extends RuleMeta {
  appliesTo: FileKind[];
  defaultOptions?: RuleOptions;
  fixHint: string;
  check(ctx: RuleContext): void;
}

export interface ReportArgs {
  line: number;
  column: number;
  message: string;
  endLine?: number;
  severity?: Severity;
  fixHint?: string;
  anchorLine?: number;
}

export interface RuleContext {
  file: ParsedFile;
  options: RuleOptions;
  report(a: ReportArgs): void;
  ancestors(el: ElementNode): Iterable<ElementNode>;
  hasClassInChain(el: ElementNode, pred: (t: ClassToken) => boolean): boolean;
  classesOf(el: ElementNode): ClassToken[];
  textOf(el: ElementNode): string;
}

export type RuleSetting =
  | "off"
  | Severity
  | { severity?: Severity | "off"; weight?: number; options?: RuleOptions };

export interface UislopConfig {
  include: string[];
  exclude: string[];
  useDefaultExcludes: boolean;
  rules: Record<string, RuleSetting>;
  maxSlop: number | null;
  maxFileSlop: number | null;
  ignore: { files: string[]; rules?: string[] }[];
  ignoreText: string[];
  classFunctions: string[];
  maxFileSize: number;
}

export type TierId = "bespoke-craft" | "minor-slop" | "template-vibe" | "pure-ai-slop";

export interface FileResult {
  path: string;
  kind: FileKind;
  units: number;
  findings: number;
  raw: number;
  score: number;
  parseMode: ParsedFile["parseMode"];
}

export interface CategoryScore {
  id: Category;
  findings: number;
  raw: number;
  points: number;
}

export interface ScoreResult {
  score: number;
  tier: TierId;
  tierLabel: string;
  raw: number;
  units: number;
  density: number;
  categories: CategoryScore[];
  files: FileResult[];
  worstFile: string | null;
}

export interface ScanWarning {
  file?: string;
  message: string;
}

export interface ScanResult {
  root: string;
  configPath: string | null;
  durationMs: number;
  findings: Finding[];
  score: ScoreResult;
  warnings: ScanWarning[];
  stats: { filesScanned: number; filesSkipped: number };
}
