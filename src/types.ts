export type ExprNode =
  | { type: 'Identifier'; path: string[] }
  | { type: 'Number'; value: number }
  | { type: 'String'; value: string }
  | { type: 'Boolean'; value: boolean }
  | { type: 'Null' }
  | { type: 'Undefined' }
  | { type: 'UnaryNot'; operand: ExprNode }
  | { type: 'UnaryMinus'; operand: ExprNode }
  | { type: 'BinaryOp'; op: '&&' | '||' | '>' | '<' | '>=' | '<=' | '==' | '!=' | '+' | '-' | '*' | '/'; left: ExprNode; right: ExprNode }
  | { type: 'CallExpression'; callee: ExprNode; args: ExprNode[] }
  | { type: 'Ternary'; condition: ExprNode; then: ExprNode; else: ExprNode }

export interface Token {
  type: 'Text' | 'Variable' | 'RawVariable' | 'EachOpen' | 'EachClose' | 'IfOpen' | 'IfClose' | 'Else' | 'UnlessOpen' | 'UnlessClose' | 'WithOpen' | 'WithClose' | 'DefOpen' | 'DefClose' | 'Partial' | 'LayoutOpen' | 'LayoutClose'
  value?: string
}

export interface ASTNodeText { type: 'Text'; value: string }
export interface ASTNodeVariable { type: 'Variable'; expression: string }
export interface ASTNodeRawVariable { type: 'RawVariable'; expression: string }
export interface ASTNodeEach { type: 'Each'; expression: string; children: ASTNode[] }
export interface ASTNodeIf { type: 'If'; expression: string; exprAst?: ExprNode; children: ASTNode[]; elseChildren: ASTNode[] }
export interface ASTNodeUnless { type: 'Unless'; expression: string; exprAst?: ExprNode; children: ASTNode[] }
export interface ASTNodeWith { type: 'With'; expression: string; children: ASTNode[] }
export interface ASTNodePartialDef { type: 'PartialDef'; name: string; children: ASTNode[] }
export interface ASTNodePartial { type: 'Partial'; name: string }
export interface ASTNodeLayout { type: 'Layout'; name: string; children: ASTNode[] }

export type ASTNode = ASTNodeText | ASTNodeVariable | ASTNodeRawVariable | ASTNodeEach | ASTNodeIf | ASTNodeUnless | ASTNodeWith | ASTNodePartialDef | ASTNodePartial | ASTNodeLayout

export type CompiledTemplate = (
  data: unknown,
  helpers: Record<string, (this: unknown, ...args: unknown[]) => unknown> | undefined,
  escapeHTML: (s: string) => string,
) => string

export interface RenderOptions {
  partialsDir?: string
  cache?: boolean
  autoescape?: boolean
  helpers?: Record<string, (this: unknown, ...args: unknown[]) => unknown>
}
