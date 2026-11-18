import { parse, type ParserPlugin } from "@babel/parser";
import { nextGroup, tokenizeClassString, UTILITY_PREFIX_RE } from "./classes";
import { addClassTokens, addElement, addText, emptyFacts, INLINE_BLOCK_BASE, type Facts } from "./facts";
import { classifyHandlerAst } from "./handlers";
import { collapseWhitespace, COPY_ATTRS, COPY_PROP_KEY_RE, decodeEntities, ICON_PROP_KEY_RE } from "./text";
import type { AttrInfo, ClassToken, ElementNode, LineIndex } from "../types";

type Node = { type: string; start: number; end: number; [key: string]: unknown };

const SKIP_KEYS = new Set([
  "type", "start", "end", "loc", "range", "extra", "leadingComments", "trailingComments", "innerComments",
  "errors", "comments", "tokens",
]);
const CLASS_ATTR_RE = /^(className|class|[a-zA-Z]+ClassName|tw)$/;
const HANDLER_ATTR_RE = /^on[A-Z]/;
const CLASS_TOKEN_SHAPE_RE = /^[!-]?[a-z0-9@\[\]():\/._#%,&>*=~!+-]+$/i;
const NUMERIC_NAME_RE =
  /^(count|total|price|amount|balance|revenue|subtotal|qty|quantity|percent(age)?|score|metric|stat|views|users|downloads|duration|elapsed)\w*$/i;
const NUMERIC_CALL_RE = /(toFixed|toLocaleString|format)$/;
const UNWRAP_TYPES = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "ParenthesizedExpression"]);

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as Node).type === "string";
}

function unwrap(node: Node): Node {
  let current = node;
  while (UNWRAP_TYPES.has(current.type)) current = current.expression as Node;
  return current;
}

function staticString(node: Node): string | null {
  if (node.type === "StringLiteral") return node.value as string;
  if (node.type === "TemplateLiteral" && (node.expressions as Node[]).length === 0) {
    const quasi = (node.quasis as Node[])[0];
    return ((quasi?.value as { cooked?: string } | undefined)?.cooked ?? "") as string;
  }
  return null;
}

function jsxName(name: Node): string {
  if (name.type === "JSXIdentifier") return name.name as string;
  if (name.type === "JSXNamespacedName") {
    return `${(name.namespace as Node).name as string}:${(name.name as Node).name as string}`;
  }
  if (name.type === "JSXMemberExpression") {
    return `${jsxName(name.object as Node)}.${(name.property as Node).name as string}`;
  }
  return "";
}

function calleeName(callee: Node): string {
  const target = unwrap(callee);
  if (target.type === "Identifier") return target.name as string;
  if ((target.type === "MemberExpression" || target.type === "OptionalMemberExpression") && isNode(target.property)) {
    return (target.property.name as string | undefined) ?? "";
  }
  return "";
}

function propertyKey(prop: Node): string | null {
  if (prop.computed) return null;
  const key = prop.key as Node;
  if (key.type === "Identifier") return key.name as string;
  if (key.type === "StringLiteral") return key.value as string;
  return null;
}

function camelToKebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function returnedJsx(fn: Node): Node[] {
  const fromExpr = (expr: Node | null | undefined): Node[] => {
    if (!expr) return [];
    const node = unwrap(expr);
    if (node.type === "JSXElement") return [node];
    if (node.type === "ConditionalExpression") {
      return [...fromExpr(node.consequent as Node), ...fromExpr(node.alternate as Node)];
    }
    if (node.type === "LogicalExpression") return fromExpr(node.right as Node);
    return [];
  };
  const body = fn.body as Node;
  if (body.type !== "BlockStatement") return fromExpr(body);
  const statements = body.body as Node[];
  const last = [...statements].reverse().find((s) => s.type === "ReturnStatement");
  return fromExpr(last?.argument as Node | undefined);
}

class TsxWalker {
  readonly facts: Facts = emptyFacts();
  private readonly consumed = new Set<number>();
  private readonly repeatTargets = new Map<Node, number | null>();

  constructor(
    private readonly source: string,
    private readonly lines: LineIndex,
    private readonly classFunctions: Set<string>,
  ) {}

  run(program: Node): void {
    this.collectConstArrays(program);
    this.walk(program, null);
  }

  private collectConstArrays(program: Node): void {
    for (const statement of program.body as Node[]) {
      const declaration =
        statement.type === "ExportNamedDeclaration" && isNode(statement.declaration) ? statement.declaration : statement;
      if (declaration.type !== "VariableDeclaration") continue;
      for (const declarator of declaration.declarations as Node[]) {
        const id = declarator.id as Node;
        if (id.type !== "Identifier" || !isNode(declarator.init)) continue;
        const init = unwrap(declarator.init);
        if (init.type === "ArrayExpression") this.facts.constArrays.set(id.name as string, (init.elements as unknown[]).length);
      }
    }
  }

  private walk(node: Node, parent: ElementNode | null): void {
    switch (node.type) {
      case "JSXElement":
        this.element(node, parent);
        return;
      case "JSXText":
        this.jsxText(node, parent);
        return;
      case "JSXExpressionContainer":
        this.childExpression(node.expression as Node, parent);
        return;
      case "CallExpression":
      case "OptionalCallExpression":
        if (!this.consumed.has(node.start) && this.classFunctions.has(calleeName(node.callee as Node))) {
          this.collectClasses(node, undefined, "call", nextGroup());
        }
        break;
      case "TaggedTemplateExpression":
        if (!this.consumed.has(node.start) && calleeName(node.tag as Node) === "tw") {
          this.collectClasses(node, undefined, "template", nextGroup());
        }
        break;
      case "ObjectProperty":
        this.objectPropertyText(node);
        break;
      case "StringLiteral":
      case "TemplateLiteral":
        this.heuristicClassString(node);
        break;
    }
    this.descend(node, parent);
  }

  private descend(node: Node, parent: ElementNode | null): void {
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) if (isNode(item)) this.walk(item, parent);
      } else if (isNode(value)) {
        this.walk(value, parent);
      }
    }
  }

  private element(node: Node, parent: ElementNode | null): void {
    const opening = node.openingElement as Node;
    const tag = jsxName(opening.name as Node);
    const isComponent = /^[A-Z]/.test(tag) || tag.includes(".");
    const el = addElement(this.facts, this.lines, tag, isComponent, opening.start, parent);
    if (this.repeatTargets.has(node)) el.repeated = { source: "map", count: this.repeatTargets.get(node) ?? null };
    for (const attr of opening.attributes as Node[]) {
      if (attr.type === "JSXSpreadAttribute") this.walk(attr.argument as Node, el);
      else this.attribute(attr, el);
    }
    for (const child of node.children as Node[]) this.walk(child, el);
    el.endOffset = node.end;
  }

  private attribute(attr: Node, el: ElementNode): void {
    const name = jsxName(attr.name as Node);
    const pos = this.lines.pos(attr.start);
    const valueNode = attr.value as Node | null;
    const info: AttrInfo = { name, line: pos.line, column: pos.column, kind: "bool", value: null };
    let expr: Node | null = null;
    if (valueNode?.type === "StringLiteral") {
      info.kind = "string";
      info.value = valueNode.value as string;
    } else if (valueNode?.type === "JSXExpressionContainer") {
      const inner = valueNode.expression as Node;
      if (inner.type === "JSXEmptyExpression") {
        info.kind = "none";
      } else {
        info.kind = "expr";
        info.value = staticString(inner);
        expr = inner;
      }
    } else if (valueNode) {
      expr = valueNode;
      info.kind = "expr";
    }
    el.attrs.set(name, info);

    if (CLASS_ATTR_RE.test(name)) {
      const target = valueNode?.type === "StringLiteral" ? valueNode : expr;
      if (target) this.collectClasses(target, el, "attr", nextGroup());
      return;
    }
    if (name === "style" && expr?.type === "ObjectExpression") {
      this.styleObject(expr, el);
      return;
    }
    if (HANDLER_ATTR_RE.test(name) && expr) info.handler = classifyHandlerAst(expr);
    const stringNode = valueNode?.type === "StringLiteral" ? valueNode : expr && staticString(expr) !== null ? expr : null;
    if (stringNode) {
      this.consumed.add(stringNode.start);
      if (COPY_ATTRS.has(name) && info.value && info.value.trim()) {
        const text = collapseWhitespace(decodeEntities(info.value));
        this.addTextAt(text, stringNode.start + 1, "attr", el, name);
      }
    }
    if (expr) this.walk(expr, el);
  }

  private styleObject(expr: Node, el: ElementNode): void {
    const blockId = INLINE_BLOCK_BASE + el.id;
    for (const prop of expr.properties as Node[]) {
      if (prop.type !== "ObjectProperty" || (prop.key as Node).type !== "Identifier") continue;
      const value = staticString(prop.value as Node);
      if (value === null) continue;
      const pos = this.lines.pos(prop.start);
      this.facts.decls.push({
        prop: camelToKebab((prop.key as Node).name as string),
        value,
        line: pos.line,
        column: pos.column,
        offset: prop.start,
        selector: "",
        atRule: null,
        blockId,
      });
    }
  }

  private addTextAt(text: string, offset: number, origin: "jsx-text" | "jsx-expr" | "attr" | "prop", el: ElementNode | null, attrName?: string): void {
    addText(this.facts, this.lines, text, offset, origin, el, attrName);
  }

  private jsxText(node: Node, parent: ElementNode | null): void {
    const raw = this.source.slice(node.start, node.end);
    const text = collapseWhitespace(decodeEntities(raw));
    if (!text) return;
    const lead = raw.search(/\S/);
    this.addTextAt(text, node.start + Math.max(0, lead), "jsx-text", parent);
  }

  private childExpression(expr: Node, parent: ElementNode | null): void {
    if (expr.type === "JSXEmptyExpression") return;
    const value = staticString(expr);
    if (value !== null) {
      this.consumed.add(expr.start);
      const text = collapseWhitespace(value);
      if (text) this.addTextAt(text, expr.start + 1, "jsx-expr", parent);
      return;
    }
    const target = unwrap(expr);
    const isMap =
      (target.type === "CallExpression" || target.type === "OptionalCallExpression") &&
      calleeName(target.callee as Node) === "map" &&
      isNode((target.arguments as Node[])[0]) &&
      /Function/.test(((target.arguments as Node[])[0] as Node).type);
    if (isMap) {
      const count = this.mapCount(target.callee as Node);
      for (const jsx of returnedJsx((target.arguments as Node[])[0] as Node)) this.repeatTargets.set(jsx, count);
    } else if (parent) {
      parent.hasDynamicChild = true;
      this.collectBranchStrings(target, parent);
      if (!parent.dynamicNumeric && this.isNumericExpression(target)) {
        const pos = this.lines.pos(target.start);
        parent.dynamicNumeric = { line: pos.line, column: pos.column, text: this.source.slice(target.start, target.end) };
      }
    }
    this.walk(expr, parent);
  }

  private mapCount(callee: Node): number | null {
    const object = unwrap(callee.object as Node);
    if (object.type === "ArrayExpression") return (object.elements as unknown[]).length;
    if (object.type === "Identifier") return this.facts.constArrays.get(object.name as string) ?? null;
    return null;
  }

  private collectBranchStrings(expr: Node, parent: ElementNode): void {
    const node = unwrap(expr);
    const value = staticString(node);
    if (value !== null) {
      this.consumed.add(node.start);
      const text = collapseWhitespace(value);
      if (text) this.addTextAt(text, node.start + 1, "jsx-expr", parent);
      return;
    }
    if (node.type === "ConditionalExpression") {
      this.collectBranchStrings(node.consequent as Node, parent);
      this.collectBranchStrings(node.alternate as Node, parent);
    } else if (node.type === "LogicalExpression") {
      if (node.operator !== "&&") this.collectBranchStrings(node.left as Node, parent);
      this.collectBranchStrings(node.right as Node, parent);
    }
  }

  private isNumericExpression(expr: Node): boolean {
    if (expr.type === "CallExpression" || expr.type === "OptionalCallExpression") {
      return NUMERIC_CALL_RE.test(calleeName(expr.callee as Node));
    }
    if (expr.type === "Identifier") return NUMERIC_NAME_RE.test(expr.name as string);
    if ((expr.type === "MemberExpression" || expr.type === "OptionalMemberExpression") && isNode(expr.property)) {
      return expr.property.type === "Identifier" && NUMERIC_NAME_RE.test(expr.property.name as string);
    }
    return false;
  }

  private objectPropertyText(node: Node): void {
    const key = propertyKey(node);
    if (!key || !COPY_PROP_KEY_RE.test(key) || !isNode(node.value)) return;
    const valueNode = node.value;
    const value = staticString(valueNode);
    if (value === null || this.consumed.has(valueNode.start)) return;
    const text = collapseWhitespace(value);
    if (text.length < 3 && !ICON_PROP_KEY_RE.test(key)) return;
    if (!text) return;
    this.consumed.add(valueNode.start);
    this.addTextAt(text, valueNode.start + 1, "prop", null, key);
  }

  private heuristicClassString(node: Node): void {
    if (this.consumed.has(node.start)) return;
    const value = staticString(node);
    if (value === null) return;
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length < 2 || !parts.every((p) => CLASS_TOKEN_SHAPE_RE.test(p))) return;
    if (parts.filter((p) => UTILITY_PREFIX_RE.test(p)).length < 2 || !parts.some((p) => /[-:]/.test(p))) return;
    this.consumed.add(node.start);
    const start = node.type === "StringLiteral" ? node.start + 1 : ((node.quasis as Node[])[0] as Node).start;
    this.addTokens(tokenizeClassString(value, start, this.lines, "heuristic", nextGroup()));
  }

  private addTokens(tokens: ClassToken[]): void {
    addClassTokens(this.facts, tokens);
  }

  private tokenizeSlice(start: number, end: number, owner: ElementNode | undefined, origin: ClassToken["origin"], group: number): ClassToken[] {
    return tokenizeClassString(this.source.slice(start, end), start, this.lines, origin, group, owner);
  }

  private collectClasses(input: Node, owner: ElementNode | undefined, origin: ClassToken["origin"], group: number, mode: "cn" | "cva" = "cn"): void {
    const node = unwrap(input);
    switch (node.type) {
      case "StringLiteral":
        if (this.consumed.has(node.start)) return;
        this.consumed.add(node.start);
        this.addTokens(this.tokenizeSlice(node.start + 1, node.end - 1, owner, origin, group));
        return;
      case "TemplateLiteral":
        this.collectTemplate(node, owner, group);
        return;
      case "ConditionalExpression":
        this.collectClasses(node.consequent as Node, owner, origin, group);
        this.collectClasses(node.alternate as Node, owner, origin, group);
        return;
      case "LogicalExpression":
        if (node.operator !== "&&") this.collectClasses(node.left as Node, owner, origin, group);
        this.collectClasses(node.right as Node, owner, origin, group);
        return;
      case "ArrayExpression":
        for (const item of node.elements as (Node | null)[]) {
          if (!item) continue;
          this.collectClasses(item.type === "SpreadElement" ? (item.argument as Node) : item, owner, origin, group);
        }
        return;
      case "ObjectExpression":
        if (mode === "cn") this.collectObjectKeys(node, owner, origin, group);
        return;
      case "CallExpression":
      case "OptionalCallExpression":
        this.collectCall(node, owner, group);
        return;
      case "TaggedTemplateExpression":
        if (calleeName(node.tag as Node) === "tw") {
          this.consumed.add(node.start);
          this.collectTemplate(node.quasi as Node, owner, group);
        }
        return;
    }
  }

  private collectObjectKeys(node: Node, owner: ElementNode | undefined, origin: ClassToken["origin"], group: number): void {
    for (const prop of node.properties as Node[]) {
      if (prop.type !== "ObjectProperty" || prop.computed) continue;
      const key = prop.key as Node;
      if (key.type === "StringLiteral") {
        this.consumed.add(key.start);
        this.addTokens(this.tokenizeSlice(key.start + 1, key.end - 1, owner, origin, group));
      } else if (key.type === "Identifier") {
        this.addTokens(this.tokenizeSlice(key.start, key.end, owner, origin, group));
      }
    }
  }

  private collectCall(node: Node, owner: ElementNode | undefined, group: number): void {
    const callee = unwrap(node.callee as Node);
    const name = calleeName(callee);
    const args = node.arguments as Node[];
    if (name === "join" && (callee.type === "MemberExpression" || callee.type === "OptionalMemberExpression")) {
      this.consumed.add(node.start);
      this.collectClasses(callee.object as Node, owner, "call", group);
      return;
    }
    if (!this.classFunctions.has(name)) return;
    this.consumed.add(node.start);
    if (name === "cva" || name === "tv") {
      if (args[0]) this.collectClasses(args[0], owner, "call", group);
      const config = args[1] ? unwrap(args[1]) : null;
      if (config?.type === "ObjectExpression") this.collectVariantConfig(config, owner);
      const first = args[0] ? unwrap(args[0]) : null;
      if (name === "tv" && first?.type === "ObjectExpression") this.collectVariantConfig(first, owner);
      return;
    }
    for (const arg of args) this.collectClasses(arg.type === "SpreadElement" ? (arg.argument as Node) : arg, owner, "call", group);
  }

  private collectVariantConfig(config: Node, owner: ElementNode | undefined): void {
    for (const prop of config.properties as Node[]) {
      if (prop.type !== "ObjectProperty") continue;
      const key = propertyKey(prop);
      const value = unwrap(prop.value as Node);
      if (key === "base") {
        this.collectClasses(value, owner, "call", nextGroup());
      } else if ((key === "variants" || key === "slots") && value.type === "ObjectExpression") {
        for (const entry of value.properties as Node[]) {
          if (entry.type !== "ObjectProperty") continue;
          const entryValue = unwrap(entry.value as Node);
          if (key === "slots" || entryValue.type !== "ObjectExpression") {
            this.collectClasses(entryValue, owner, "call", nextGroup());
            continue;
          }
          for (const option of entryValue.properties as Node[]) {
            if (option.type === "ObjectProperty") this.collectClasses(option.value as Node, owner, "call", nextGroup());
          }
        }
      } else if (key === "compoundVariants" && value.type === "ArrayExpression") {
        for (const item of value.elements as (Node | null)[]) {
          if (!item || item.type !== "ObjectExpression") continue;
          for (const field of item.properties as Node[]) {
            const fieldKey = field.type === "ObjectProperty" ? propertyKey(field) : null;
            if (fieldKey === "class" || fieldKey === "className") {
              this.collectClasses(field.value as Node, owner, "call", nextGroup());
            }
          }
        }
      }
    }
  }

  private collectTemplate(node: Node, owner: ElementNode | undefined, group: number): void {
    this.consumed.add(node.start);
    const quasis = node.quasis as Node[];
    quasis.forEach((quasi, i) => {
      const raw = this.source.slice(quasi.start, quasi.end);
      const tokens = this.tokenizeSlice(quasi.start, quasi.end, owner, "template", group);
      if (i > 0 && /^\S/.test(raw)) tokens.shift();
      if (i < quasis.length - 1 && /\S$/.test(raw)) tokens.pop();
      this.addTokens(tokens);
    });
    for (const expr of node.expressions as Node[]) this.collectClasses(expr, owner, "template", group);
  }
}

function babelParse(source: string, plugins: ParserPlugin[]): Node {
  return parse(source, {
    sourceType: "module",
    plugins,
    errorRecovery: true,
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true,
    allowImportExportEverywhere: true,
    allowUndeclaredExports: true,
    tokens: false,
    ranges: false,
    createParenthesizedExpressions: false,
  }) as unknown as Node;
}

function parseAst(source: string, kind: "tsx" | "jsx"): Node {
  if (kind === "tsx") return babelParse(source, ["jsx", "typescript"]);
  try {
    return babelParse(source, ["jsx"]);
  } catch {
    return babelParse(source, ["jsx", "typescript"]);
  }
}

const FALLBACK_CLASS_RE = /\b(?:className|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\})/g;
const FALLBACK_TEXT_RE = />([^<>{}]+)</g;
const FALLBACK_COMMENT_RE = /\/\/([^\n]*)|\/\*([\s\S]*?)\*\//g;

function fallbackFacts(source: string, lines: LineIndex, reason: string): Facts {
  const facts = emptyFacts();
  facts.parseMode = "fallback";
  facts.warnings.push(`parse failed (${reason}); used regex fallback`);
  for (const match of source.matchAll(FALLBACK_CLASS_RE)) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    const start = (match.index as number) + match[0].indexOf(value);
    addClassTokens(facts, tokenizeClassString(value, start, lines, "attr", nextGroup()));
  }
  for (const match of source.matchAll(FALLBACK_TEXT_RE)) {
    const raw = match[1] as string;
    const text = collapseWhitespace(decodeEntities(raw));
    if (!text) continue;
    addText(facts, lines, text, (match.index as number) + 1 + raw.search(/\S/), "jsx-text", null);
  }
  for (const match of source.matchAll(FALLBACK_COMMENT_RE)) {
    const value = match[1] ?? match[2] ?? "";
    facts.comments.push({ value, start: match.index as number, end: (match.index as number) + match[0].length });
  }
  return facts;
}

export function parseTsx(source: string, lines: LineIndex, kind: "tsx" | "jsx", classFunctions: string[]): Facts {
  let ast: Node;
  try {
    ast = parseAst(source, kind);
  } catch (error) {
    return fallbackFacts(source, lines, (error as Error).message.split("\n")[0] ?? "syntax error");
  }
  const walker = new TsxWalker(source, lines, new Set(classFunctions));
  walker.run(ast.program as Node);
  const facts = walker.facts;
  if ((ast.errors as unknown[] | undefined)?.length) facts.parseMode = "recovered";
  for (const comment of (ast.comments as Node[] | undefined) ?? []) {
    facts.comments.push({ value: comment.value as string, start: comment.start, end: comment.end });
  }
  return facts;
}
