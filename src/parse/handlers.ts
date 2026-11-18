import type { HandlerKind } from "../types";

type AstNode = { type: string; [key: string]: unknown };

const NOOP_IDENTS = new Set(["noop", "noOp", "NOOP"]);
const DIALOG_FNS = new Set(["alert", "prompt", "confirm"]);
const EVENT_ONLY_METHODS = new Set(["preventDefault", "stopPropagation"]);

function callKind(expr: AstNode): HandlerKind {
  if (expr.type !== "CallExpression") return "other";
  const callee = expr.callee as AstNode;
  if (callee.type === "Identifier" && DIALOG_FNS.has(callee.name as string)) return "alert";
  if (callee.type !== "MemberExpression") return "other";
  const object = callee.object as AstNode;
  const property = callee.property as AstNode;
  const method = property.type === "Identifier" ? (property.name as string) : "";
  if (object.type === "Identifier" && object.name === "console") return "console";
  if (object.type === "Identifier" && object.name === "window" && DIALOG_FNS.has(method)) return "alert";
  if (EVENT_ONLY_METHODS.has(method)) return "preventdefault-only";
  return "other";
}

function isEmptyValue(expr: AstNode): boolean {
  if (expr.type === "NullLiteral") return true;
  if (expr.type === "Identifier" && expr.name === "undefined") return true;
  return expr.type === "UnaryExpression" && expr.operator === "void";
}

function statementsKind(statements: AstNode[]): HandlerKind {
  if (statements.length === 0) return "empty";
  const kinds = new Set(
    statements.map((s) => (s.type === "ExpressionStatement" ? callKind(s.expression as AstNode) : "other")),
  );
  if (kinds.size !== 1) return "other";
  return [...kinds][0] as HandlerKind;
}

export function classifyHandlerAst(expr: AstNode): HandlerKind {
  if (expr.type === "Identifier") return NOOP_IDENTS.has(expr.name as string) ? "noop-ident" : "other";
  if (expr.type !== "ArrowFunctionExpression" && expr.type !== "FunctionExpression") return "other";
  const body = expr.body as AstNode;
  if (body.type === "BlockStatement") return statementsKind(body.body as AstNode[]);
  if (isEmptyValue(body)) return "empty";
  return callKind(body);
}

export function classifyHandlerString(code: string): HandlerKind {
  const value = code.trim().replace(/^javascript:/i, "").trim();
  if (/^(;?|return false;?|void\s*\(?0\)?;?)$/i.test(value)) return "empty";
  if (/^console\.\w+\(.*\);?$/s.test(value)) return "console";
  if (/^(window\.)?(alert|prompt|confirm)\(.*\);?$/s.test(value)) return "alert";
  return "other";
}
