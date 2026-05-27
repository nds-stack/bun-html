export interface Token {
  type: 'Text' | 'Variable' | 'RawVariable' | 'EachOpen' | 'EachClose' | 'IfOpen' | 'IfClose' | 'Else' | 'UnlessOpen' | 'UnlessClose' | 'Partial' | 'LayoutOpen' | 'LayoutClose'
  value?: string
}

export interface ASTNodeText { type: 'Text'; value: string }
export interface ASTNodeVariable { type: 'Variable'; expression: string }
export interface ASTNodeRawVariable { type: 'RawVariable'; expression: string }
export interface ASTNodeEach { type: 'Each'; expression: string; children: ASTNode[] }
export interface ASTNodeIf { type: 'If'; expression: string; children: ASTNode[]; elseChildren: ASTNode[] }
export interface ASTNodeUnless { type: 'Unless'; expression: string; children: ASTNode[] }
export interface ASTNodePartial { type: 'Partial'; name: string }
export interface ASTNodeLayout { type: 'Layout'; name: string; children: ASTNode[] }

export type ASTNode = ASTNodeText | ASTNodeVariable | ASTNodeRawVariable | ASTNodeEach | ASTNodeIf | ASTNodeUnless | ASTNodePartial | ASTNodeLayout

export interface RenderOptions {
  partialsDir?: string
  cache?: boolean
  autoescape?: boolean
  helpers?: Record<string, (this: unknown, ...args: unknown[]) => unknown>
}
