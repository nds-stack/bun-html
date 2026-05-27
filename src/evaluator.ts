import type { ExprNode } from './types.js'
import { validateKey } from './types.js'

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
        validateKey(part)
        if (value === null || value === undefined) return undefined
        value = (value as any)?.[part]
      }
      return value
    }
    case 'UnaryNot': {
      return !evaluateExpr(node.operand, data, index, key, stack)
    }
    case 'UnaryMinus': {
      const val = evaluateExpr(node.operand, data, index, key, stack)
      return val == null ? 0 : -Number(val)
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
      if (node.op === '??') {
        const left = evaluateExpr(node.left, data, index, key, stack)
        if (left !== null && left !== undefined) return left
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
        case '+': return Number(left) + Number(right)
        case '-': return Number(left) - Number(right)
        case '*': return Number(left) * Number(right)
        case '/': return Number(left) / Number(right)
        default: { const _: never = node.op; return _ }
      }
    }
    case 'CallExpression': {
      const callee = evaluateExpr(node.callee, data, index, key, stack)
      if (typeof callee !== 'function') return undefined
      const args = node.args.map(a => evaluateExpr(a, data, index, key, stack))

      let receiver: unknown = undefined
      if (node.callee.type === 'Identifier' && node.callee.path.length > 1) {
        const parentPath = node.callee.path.slice(0, -1)
        receiver = evaluateExpr({ type: 'Identifier', path: parentPath }, data, index, key, stack)
      }

      return callee.apply(receiver, args)
    }
    case 'Ternary': {
      const cond = evaluateExpr(node.condition, data, index, key, stack)
      return cond ? evaluateExpr(node.then, data, index, key, stack) : evaluateExpr(node.else, data, index, key, stack)
    }
    case 'ArrayLiteral': {
      return node.elements.map(e => evaluateExpr(e, data, index, key, stack))
    }
    case 'ObjectLiteral': {
      const obj: Record<string, unknown> = {}
      for (const entry of node.entries) {
        obj[entry.key] = evaluateExpr(entry.value, data, index, key, stack)
      }
      return obj
    }
    default: {
      const _: never = node
      return _
    }
  }
}
