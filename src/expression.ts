import type { ExprNode } from './types.js'

export type ExprTokenType =
  | 'Identifier' | 'Number' | 'String' | 'Boolean' | 'Null' | 'Undefined'
  | 'ParenOpen' | 'ParenClose'
  | 'Not' | 'And' | 'Or'
  | 'Gt' | 'Lt' | 'Gte' | 'Lte' | 'Eq' | 'Neq'

export interface ExprToken {
  type: ExprTokenType
  value?: string
}

export function tokenizeExpr(input: string): ExprToken[] {
  const tokens: ExprToken[] = []
  let i = 0

  while (i < input.length) {
    if (/\s/.test(input[i]!)) { i++; continue }

    if (input[i] === "'" || input[i] === '"') {
      const quote = input[i]!
      let j = i + 1
      while (j < input.length && input[j] !== quote) j++
      tokens.push({ type: 'String', value: input.slice(i + 1, j) })
      i = j + 1
      continue
    }

    if (/\d/.test(input[i]!)) {
      const numMatch = input.slice(i).match(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)
      if (numMatch) {
        tokens.push({ type: 'Number', value: numMatch[0] })
        i += numMatch[0].length
        continue
      }
    }

    if (/[a-zA-Z_$]/.test(input[i]!)) {
      let j = i
      while (j < input.length && /[a-zA-Z0-9_$.]/.test(input[j]!)) j++
      const word = input.slice(i, j)
      if (word === 'true' || word === 'false') tokens.push({ type: 'Boolean', value: word })
      else if (word === 'null') tokens.push({ type: 'Null' })
      else if (word === 'undefined') tokens.push({ type: 'Undefined' })
      else tokens.push({ type: 'Identifier', value: word })
      i = j
      continue
    }

    if (input[i] === '.' && i + 2 < input.length && input[i + 1] === '.' && input[i + 2] === '/') {
      let j = i + 3
      while (j < input.length && /[a-zA-Z0-9_$.]/.test(input[j]!)) j++
      tokens.push({ type: 'Identifier', value: input.slice(i, j) })
      i = j
      continue
    }

    const two = input.slice(i, i + 2)
    if (two === '&&') { tokens.push({ type: 'And' }); i += 2; continue }
    if (two === '||') { tokens.push({ type: 'Or' }); i += 2; continue }
    if (two === '>=') { tokens.push({ type: 'Gte' }); i += 2; continue }
    if (two === '<=') { tokens.push({ type: 'Lte' }); i += 2; continue }
    if (two === '==') { tokens.push({ type: 'Eq' }); i += 2; continue }
    if (two === '!=') { tokens.push({ type: 'Neq' }); i += 2; continue }

    if (input[i] === '(') { tokens.push({ type: 'ParenOpen' }); i++; continue }
    if (input[i] === ')') { tokens.push({ type: 'ParenClose' }); i++; continue }
    if (input[i] === '>') { tokens.push({ type: 'Gt' }); i++; continue }
    if (input[i] === '<') { tokens.push({ type: 'Lt' }); i++; continue }
    if (input[i] === '!') { tokens.push({ type: 'Not' }); i++; continue }

    throw new Error(`Unexpected character '${input[i]}' in expression`)
  }

  return tokens
}

function parseTokens(tokens: ExprToken[]): ExprNode {
  let pos = 0

  function peek(): ExprToken | undefined {
    return tokens[pos]
  }

  function consume(type?: ExprTokenType): ExprToken {
    const token = tokens[pos]
    if (!token) throw new Error('Unexpected end of expression')
    if (type !== undefined && token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type} (${token.value ?? ''})`)
    }
    pos++
    return token
  }

  function parsePrimary(): ExprNode {
    const token = peek()
    if (!token) throw new Error('Unexpected end of expression')

    switch (token.type) {
      case 'Number':
        consume()
        return { type: 'Number', value: parseFloat(token.value!) }
      case 'String':
        consume()
        return { type: 'String', value: token.value! }
      case 'Boolean':
        consume()
        return { type: 'Boolean', value: token.value === 'true' }
      case 'Null':
        consume()
        return { type: 'Null' }
      case 'Undefined':
        consume()
        return { type: 'Undefined' }
      case 'Identifier': {
        consume()
        const val = token.value!
        if (val.startsWith('../')) {
          let levels = 0
          let rest = val
          while (rest.startsWith('../')) { levels++; rest = rest.slice(3) }
          const parts: string[] = []
          for (let i = 0; i < levels; i++) parts.push('..')
          parts.push(...rest.split('.'))
          return { type: 'Identifier', path: parts }
        }
        return { type: 'Identifier', path: val.split('.') }
      }
      case 'ParenOpen':
        consume()
        const expr = parseOr()
        consume('ParenClose')
        return expr
      default:
        throw new Error(`Unexpected token: ${token.type}`)
    }
  }

  function parseNot(): ExprNode {
    if (peek()?.type === 'Not') {
      consume()
      return { type: 'UnaryNot', operand: parseNot() }
    }
    return parsePrimary()
  }

  function parseComparison(): ExprNode {
    let left = parseNot()
    const token = peek()
    if (token && ['Gt', 'Lt', 'Gte', 'Lte', 'Eq', 'Neq'].includes(token.type)) {
      consume()
      const opMap: Record<string, '>' | '<' | '>=' | '<=' | '==' | '!='> = {
        Gt: '>', Lt: '<', Gte: '>=', Lte: '<=', Eq: '==', Neq: '!=',
      }
      const op = opMap[token.type]!
      const right = parseNot()
      left = { type: 'BinaryOp', op, left, right }
    }
    return left
  }

  function parseAnd(): ExprNode {
    let left = parseComparison()
    while (peek()?.type === 'And') {
      consume()
      const right = parseComparison()
      left = { type: 'BinaryOp', op: '&&', left, right }
    }
    return left
  }

  function parseOr(): ExprNode {
    let left = parseAnd()
    while (peek()?.type === 'Or') {
      consume()
      const right = parseAnd()
      left = { type: 'BinaryOp', op: '||', left, right }
    }
    return left
  }

  const result = parseOr()
  if (pos < tokens.length) {
    throw new Error(`Unexpected token after expression: ${tokens[pos]!.type}`)
  }
  return result
}

export function parseExpression(input: string): ExprNode {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Empty expression')
  const exTokens = tokenizeExpr(trimmed)
  return parseTokens(exTokens)
}

export function evaluateExpr(
  node: ExprNode,
  data: unknown,
  index?: number,
  key?: string,
  stack?: unknown[],
): unknown {
  switch (node.type) {
    case 'Number':
    case 'String':
    case 'Boolean':
      return node.value
    case 'Null':
      return null
    case 'Undefined':
      return undefined
    case 'Identifier': {
      if (node.path.length === 0) return undefined

      let levels = 0
      while (levels < node.path.length && node.path[levels] === '..') levels++

      let value: unknown
      if (levels > 0) {
        if (!stack || stack.length < levels) return undefined
        value = stack[stack.length - levels]
      } else {
        value = data
      }

      const parts = node.path.slice(levels)
      for (const part of parts) {
        if (part === '@index') { value = index; break }
        if (part === '@key') { value = key; break }
        if (part === 'this') continue
        if (value === null || value === undefined) return undefined
        if (typeof value !== 'object') return undefined
        value = (value as Record<string, unknown>)[part]
      }
      return value
    }
    case 'UnaryNot': {
      return !evaluateExpr(node.operand, data, index, key, stack)
    }
    case 'BinaryOp': {
      if (node.op === '&&') {
        const left = evaluateExpr(node.left, data, index, key, stack)
        if (!left) return left
        return evaluateExpr(node.right, data, index, key, stack)
      }
      if (node.op === '||') {
        const left = evaluateExpr(node.left, data, index, key, stack)
        if (left) return left
        return evaluateExpr(node.right, data, index, key, stack)
      }
      const left = evaluateExpr(node.left, data, index, key, stack)
      const right = evaluateExpr(node.right, data, index, key, stack)
      switch (node.op) {
        case '>': return Number(left) > Number(right)
        case '<': return Number(left) < Number(right)
        case '>=': return Number(left) >= Number(right)
        case '<=': return Number(left) <= Number(right)
        case '==': return left == right
        case '!=': return left != right
      }
    }
  }
}
