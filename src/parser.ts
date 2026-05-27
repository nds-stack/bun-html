import type { Token, ASTNode } from './types.js'
import { parseExpression } from './expression.js'

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
      throw new Error('Unexpected {{/each}}')

    case 'IfOpen':
      return parseIf(tokens, i)

    case 'IfClose':
      throw new Error('Unexpected {{/if}}')

    case 'UnlessOpen':
      return parseUnless(tokens, i)

    case 'UnlessClose':
      throw new Error('Unexpected {{/unless}}')

    case 'WithOpen':
      return parseWith(tokens, i)

    case 'WithClose':
      throw new Error('Unexpected {{/with}}')

    case 'DefOpen':
      return parseDef(tokens, i)

    case 'DefClose':
      throw new Error('Unexpected {{/def}}')

    case 'Partial':
      return { node: { type: 'Partial', name: token.value! }, nextIndex: i + 1 }

    case 'Else':
      throw new Error('Unexpected {{else}}')

    case 'LayoutOpen':
      return parseLayout(tokens, i)

    case 'LayoutClose':
      throw new Error('Unexpected {{/layout}}')
  }
}

function parseChildren(
  tokens: Token[],
  startIndex: number,
  closeType: string,
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
  if (!expression.trim()) throw new Error('{{#each}} requires an expression')
  i++

  const { children, nextIndex } = parseChildren(tokens, i, 'EachClose')
  i = nextIndex

  if (i >= tokens.length) {
    throw new Error('Unclosed {{#each}}')
  }
  i++

  return { node: { type: 'Each', expression, children }, nextIndex: i }
}

function parseIf(tokens: Token[], i: number): ParseResult {
  const expression = tokens[i]!.value!
  if (!expression.trim()) throw new Error('{{#if}} requires an expression')
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
    throw new Error('Unclosed {{#if}}')
  }
  i++

  let exprAst
  try {
    if (expression.trim()) {
      exprAst = parseExpression(expression)
    }
  } catch (e) {
    throw new Error(`Invalid expression in {{#if}}: "${expression}" — ${(e as Error).message}`)
  }

  return { node: { type: 'If', expression, exprAst, children: thenChildren, elseChildren }, nextIndex: i }
}

function parseUnless(tokens: Token[], i: number): ParseResult {
  const expression = tokens[i]!.value!
  if (!expression.trim()) throw new Error('{{#unless}} requires an expression')
  i++

  const { children, nextIndex } = parseChildren(tokens, i, 'UnlessClose')
  i = nextIndex

  if (i >= tokens.length) {
    throw new Error('Unclosed {{#unless}}')
  }
  i++

  let exprAst
  try {
    if (expression.trim()) {
      exprAst = parseExpression(expression)
    }
  } catch (e) {
    throw new Error(`Invalid expression in {{#unless}}: "${expression}" — ${(e as Error).message}`)
  }

  return { node: { type: 'Unless', expression, exprAst, children }, nextIndex: i }
}

function parseWith(tokens: Token[], i: number): ParseResult {
  const expression = tokens[i]!.value!
  if (!expression.trim()) throw new Error('{{#with}} requires an expression')
  i++

  const { children, nextIndex } = parseChildren(tokens, i, 'WithClose')
  i = nextIndex

  if (i >= tokens.length) {
    throw new Error('Unclosed {{#with}}')
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
    throw new Error('Unclosed {{#def}}')
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
    throw new Error('Unclosed {{#layout}}')
  }
  i++

  return { node: { type: 'Layout', name, children }, nextIndex: i }
}
