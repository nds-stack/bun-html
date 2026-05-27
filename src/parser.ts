import type { Token, ASTNode } from './types.js'
import { parseExpression, formatPosition } from './expression.js'

export function parse(tokens: Token[]): ASTNode[] {
  const nodes: ASTNode[] = []
  let i = 0

  while (i < tokens.length) {
    const result = parseNode(tokens, i)
    nodes.push(result.node)
    i = result.nextIndex
  }

  return nodes
}

interface ParseResult {
  node: ASTNode
  nextIndex: number
}

function pos(token: Token): string {
  return formatPosition(token)
}

function parseNode(tokens: Token[], i: number): ParseResult {
  const token = tokens[i]!

  switch (token.type) {
    case 'Text':
      return { node: { type: 'Text', value: token.value! }, nextIndex: i + 1 }

    case 'Variable':
      return { node: { type: 'Variable', expression: token.value! }, nextIndex: i + 1 }

    case 'RawVariable':
      return { node: { type: 'RawVariable', expression: token.value! }, nextIndex: i + 1 }

    case 'EachOpen':
      return parseEach(tokens, i)

    case 'EachClose':
      throw new Error(`Unexpected {{/each}}${pos(token)}`)

    case 'IfOpen':
      return parseIf(tokens, i)

    case 'IfClose':
      throw new Error(`Unexpected {{/if}}${pos(token)}`)

    case 'UnlessOpen':
      return parseUnless(tokens, i)

    case 'UnlessClose':
      throw new Error(`Unexpected {{/unless}}${pos(token)}`)

    case 'WithOpen':
      return parseWith(tokens, i)

    case 'WithClose':
      throw new Error(`Unexpected {{/with}}${pos(token)}`)

    case 'DefOpen':
      return parseDef(tokens, i)

    case 'DefClose':
      throw new Error(`Unexpected {{/def}}${pos(token)}`)

    case 'Partial':
      return { node: { type: 'Partial', name: token.value! }, nextIndex: i + 1 }

    case 'Else':
      throw new Error(`Unexpected {{else}}${pos(token)}`)

    case 'LayoutOpen':
      return parseLayout(tokens, i)

    case 'LayoutClose':
      throw new Error(`Unexpected {{/layout}}${pos(token)}`)
    default:
      throw new Error(`Unknown token type: ${(token as any).type}${pos(token)}`)
  }
}

function parseChildren(
  tokens: Token[],
  startIndex: number,
  closeType: 'EachClose' | 'IfClose' | 'UnlessClose' | 'WithClose' | 'DefClose' | 'LayoutClose',
): { children: ASTNode[]; nextIndex: number } {
  const children: ASTNode[] = []
  let i = startIndex

  while (i < tokens.length && tokens[i]!.type !== closeType) {
    if (tokens[i]!.type === 'Else' && closeType === 'IfClose') {
      break
    }
    const result = parseNode(tokens, i)
    children.push(result.node)
    i = result.nextIndex
  }

  return { children, nextIndex: i }
}

function parseEach(tokens: Token[], i: number): ParseResult {
  const expression = tokens[i]!.value!
  if (!expression.trim()) throw new Error(`{{#each}} requires an expression${pos(tokens[i]!)}`)
  i++

  const { children, nextIndex } = parseChildren(tokens, i, 'EachClose')
  i = nextIndex

  if (i >= tokens.length) {
    throw new Error(`Unclosed {{#each}}${pos(tokens[tokens.length - 1]!)}`)
  }
  i++

  return { node: { type: 'Each', expression, children }, nextIndex: i }
}

function parseIf(tokens: Token[], i: number): ParseResult {
  const expression = tokens[i]!.value!
  if (!expression.trim()) throw new Error(`{{#if}} requires an expression${pos(tokens[i]!)}`)
  i++

  const { children: thenChildren, nextIndex: afterThen } = parseChildren(tokens, i, 'IfClose')
  i = afterThen

  let elseChildren: ASTNode[] = []

  if (i < tokens.length && tokens[i]!.type === 'Else') {
    i++
    const { children: elseKids, nextIndex: afterElse } = parseChildren(tokens, i, 'IfClose')
    elseChildren = elseKids
    i = afterElse
  }

  if (i >= tokens.length) {
    throw new Error(`Unclosed {{#if}}${pos(tokens[tokens.length - 1]!)}`)
  }
  i++

  let exprAst
  try {
    if (expression.trim()) {
      exprAst = parseExpression(expression)
    }
  } catch (e) {
    throw new Error(`Invalid expression in {{#if}}: "${expression}"${pos(tokens[i - 1]!)} — ${(e as Error).message}`)
  }

  return { node: { type: 'If', expression, exprAst, children: thenChildren, elseChildren }, nextIndex: i }
}

function parseUnless(tokens: Token[], i: number): ParseResult {
  const expression = tokens[i]!.value!
  if (!expression.trim()) throw new Error(`{{#unless}} requires an expression${pos(tokens[i]!)}`)
  i++

  const { children, nextIndex } = parseChildren(tokens, i, 'UnlessClose')
  i = nextIndex

  if (i >= tokens.length) {
    throw new Error(`Unclosed {{#unless}}${pos(tokens[tokens.length - 1]!)}`)
  }
  i++

  let exprAst
  try {
    if (expression.trim()) {
      exprAst = parseExpression(expression)
    }
  } catch (e) {
    throw new Error(`Invalid expression in {{#unless}}: "${expression}"${pos(tokens[i - 1]!)} — ${(e as Error).message}`)
  }

  return { node: { type: 'Unless', expression, exprAst, children }, nextIndex: i }
}

function parseWith(tokens: Token[], i: number): ParseResult {
  const expression = tokens[i]!.value!
  if (!expression.trim()) throw new Error(`{{#with}} requires an expression${pos(tokens[i]!)}`)
  i++

  const { children, nextIndex } = parseChildren(tokens, i, 'WithClose')
  i = nextIndex

  if (i >= tokens.length) {
    throw new Error(`Unclosed {{#with}}${pos(tokens[tokens.length - 1]!)}`)
  }
  i++

  return { node: { type: 'With', expression, children }, nextIndex: i }
}

function parseDef(tokens: Token[], i: number): ParseResult {
  const name = tokens[i]!.value!
  i++

  const { children, nextIndex } = parseChildren(tokens, i, 'DefClose')
  i = nextIndex

  if (i >= tokens.length) {
    throw new Error(`Unclosed {{#def}}${pos(tokens[tokens.length - 1]!)}`)
  }
  i++

  return { node: { type: 'PartialDef', name, children }, nextIndex: i }
}

function parseLayout(tokens: Token[], i: number): ParseResult {
  const name = tokens[i]!.value!
  i++

  const { children, nextIndex } = parseChildren(tokens, i, 'LayoutClose')
  i = nextIndex

  if (i >= tokens.length) {
    throw new Error(`Unclosed {{#layout}}${pos(tokens[tokens.length - 1]!)}`)
  }
  i++

  return { node: { type: 'Layout', name, children }, nextIndex: i }
}
