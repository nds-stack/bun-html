import type { ASTNode, ASTNodeVariable, ASTNodeRawVariable, ExprNode, CompiledTemplate, PipeFilter } from './types.js'
import { validateKey } from './types.js'
import { parseExpression } from './expression.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export interface SourceMapEntry {
  generatedLine: number
  sourceLine: number
  sourceColumn: number
}

export function compileToFunction(ast: ASTNode[]): CompiledTemplate {
  const body: string[] = []
  const sourceMap: SourceMapEntry[] = []

  body.push('let $ = ""')
  body.push('let __d = data')
  body.push('let __h = helpers || {}')
  body.push('let __s = []')
  body.push('let __defs = {}')
  body.push('let __depth = 0')

  genNodes(ast, body, sourceMap)

  body.push('return $')

  const code = body.join('\n')
  const fn = new Function('data', 'helpers', 'escapeHTML', code) as CompiledTemplate
  ;(fn as unknown as Record<string, unknown>).__sourceMap = sourceMap
  return fn
}

export function compileToString(ast: ASTNode[]): string {
  const body: string[] = []
  const sourceMap: SourceMapEntry[] = []

  body.push('\'use strict\'')
  body.push('let $ = ""')
  body.push('let __d = data')
  body.push('let __h = helpers || {}')
  body.push('let __s = []')
  body.push('let __defs = {}')
  body.push('let __depth = 0')

  genNodes(ast, body, sourceMap)

  body.push('return $')

  return body.join('\n')
}

export function compileToFile(ast: ASTNode[], outputPath: string): void {
  const code = compileToString(ast)
  const wrapped = `// Precompiled by @nds-stack/bun-html
export default function(data, helpers, escapeHTML) {
${code}
}
`
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, wrapped)
}

function genNodes(nodes: ASTNode[], body: string[], sourceMap: SourceMapEntry[]): void {
  for (const node of nodes) {
    genNode(node, body, sourceMap)
  }
}

function recordSource(node: ASTNode, body: string[], sourceMap: SourceMapEntry[]): void {
  if (node.source) {
    sourceMap.push({
      generatedLine: body.length,
      sourceLine: node.source.line,
      sourceColumn: node.source.column,
    })
  }
}

function genNode(node: ASTNode, body: string[], sourceMap: SourceMapEntry[]): void {
  recordSource(node, body, sourceMap)
  switch (node.type) {
    case 'Text':
      body.push(`$ += ${JSON.stringify(node.value)}`)
      break

    case 'Variable':
      genVariable(node, true, body)
      break

    case 'RawVariable':
      genVariable(node, false, body)
      break

    case 'Each':
      if (node.exprAst) {
        genEachExpr(node.exprAst, node.children, body, sourceMap)
      } else {
        genEachPath(node.expression, node.children, body, sourceMap)
      }
      break

    case 'If': {
      const condCode = node.exprAst ? genExpr(node.exprAst) : `${genSafePath(node.expression)}`
      body.push(`if (${condCode}) {`)
      genNodes(node.children, body, sourceMap)
      if (node.elseChildren.length > 0) {
        body.push(`} else {`)
        genNodes(node.elseChildren, body, sourceMap)
      }
      body.push(`}`)
      break
    }

    case 'Unless': {
      const condCode = node.exprAst ? genExpr(node.exprAst) : `${genSafePath(node.expression)}`
      body.push(`if (!(${condCode})) {`)
      genNodes(node.children, body, sourceMap)
      body.push(`}`)
      break
    }

    case 'With': {
      const target = node.exprAst ? genExpr(node.exprAst) : `__d${genPropPath(node.expression)}`
      body.push(`{`)
      body.push(`__s.push(__d)`)
      body.push(`let __with = ${target}`)
      body.push(`if (__with != null && typeof __with === 'object') {`)
      body.push(`__d = __with`)
      genNodes(node.children, body, sourceMap)
      body.push(`}`)
      body.push(`__d = __s.pop()`)
      body.push(`}`)
      break
    }

    case 'PartialDef': {
      const subBody: string[] = []
      subBody.push('let $ = ""')
      subBody.push('let __depth = $__depth + 1')
      subBody.push('if (__depth > 50) throw new Error("Partial recursion too deep (>50)")')
      genNodes(node.children, subBody, [])
      subBody.push('return $')
      body.push(`__defs[${JSON.stringify(node.name)}] = function($__depth) {\n${subBody.join('\n')}\n}`)
      break
    }

    case 'Partial': {
      body.push(`{`)
      body.push(`let __pfn = __defs[${JSON.stringify(node.name)}]`)
      body.push(`if (typeof __pfn === 'function') {`)
      body.push(`$ += __pfn(__depth)`)
      body.push(`} else {`)
      body.push(`throw new Error('Partial ' + ${JSON.stringify(node.name)} + ' not found. Define it via {{#def "' + ${JSON.stringify(node.name)} + '"}}...{{/def}} or set partialsDir.')`)
      body.push(`}`)
      body.push(`}`)
      break
    }

    case 'Layout':
      throw new Error('Layouts require partialsDir option')
  }
}

function genVariable(node: ASTNodeVariable | ASTNodeRawVariable, escape: boolean, body: string[]): void {
  let exprCode: string
  if (node.exprAst) {
    exprCode = genExpr(node.exprAst)
  } else {
    try {
      const exprAst = parseExpression(node.expression)
      exprCode = genExpr(exprAst)
    } catch {
      exprCode = genSafePath(node.expression)
    }
  }
  body.push(`{`)
  body.push(`let _v = ${exprCode}`)
  if (node.filters && node.filters.length > 0) {
    body.push(`if (_v != null) {`)
    for (const filter of node.filters) {
      const fnCode = generateFilterCall(filter)
      body.push(`_v = ${fnCode}`)
    }
    body.push(`}`)
  }
  body.push(`if (_v === void 0) {`)
  body.push(`let _hf = __h[${JSON.stringify(node.expression)}]`)
  body.push(`if (typeof _hf === 'function') _v = _hf.call(__d)`)
  body.push(`}`)
  body.push(`if (_v != null) $ += ${escape ? 'escapeHTML(String(_v))' : 'String(_v)'}`)
  body.push(`}`)
}

function generateFilterCall(filter: PipeFilter): string {
  if (filter.args.length === 0) {
    return `typeof __h[${JSON.stringify(filter.name)}] === 'function' ? __h[${JSON.stringify(filter.name)}].call(_v) : _v`
  }
  const argsStr = filter.args.map(a => typeof a === 'string' ? JSON.stringify(a) : String(a)).join(', ')
  return `typeof __h[${JSON.stringify(filter.name)}] === 'function' ? __h[${JSON.stringify(filter.name)}].call(_v, ${argsStr}) : _v`
}

function genEachPath(expression: string, children: ASTNode[], body: string[], sourceMap: SourceMapEntry[]): void {
  const items = genSafePath(expression)
  body.push(`{`)
  body.push(`let _items = ${items}`)
  body.push(`if (_items && typeof _items === 'object') {`)
  body.push(`let _entries = Array.isArray(_items) ? _items : Object.values(_items)`)
  body.push(`let _keys = Array.isArray(_items) ? _entries.map((_, _i) => String(_i)) : Object.keys(_items)`)
  body.push(`for (let _i = 0; _i < _entries.length; _i++) {`)
  body.push(`__s.push(__d)`)
  body.push(`__d = _entries[_i]`)
  genNodes(children, body, sourceMap)
  body.push(`__d = __s.pop()`)
  body.push(`}`)
  body.push(`}`)
  body.push(`}`)
}

function genEachExpr(expr: ExprNode, children: ASTNode[], body: string[], sourceMap: SourceMapEntry[]): void {
  body.push(`{`)
  body.push(`let _items = ${genExpr(expr)}`)
  body.push(`if (_items && typeof _items === 'object') {`)
  body.push(`let _entries = Array.isArray(_items) ? _items : Object.values(_items)`)
  body.push(`let _keys = Array.isArray(_items) ? _entries.map((_, _i) => String(_i)) : Object.keys(_items)`)
  body.push(`for (let _i = 0; _i < _entries.length; _i++) {`)
  body.push(`__s.push(__d)`)
  body.push(`__d = _entries[_i]`)
  genNodes(children, body, sourceMap)
  body.push(`__d = __s.pop()`)
  body.push(`}`)
  body.push(`}`)
  body.push(`}`)
}

function genPropPath(expression: string): string {
  if (expression === 'this') return ''
  const parts = expression.split('.')
  let code = ''
  for (const part of parts) {
    code += `?.[${JSON.stringify(part)}]`
  }
  return code
}

function genSafePath(expression: string): string {
  let rest = expression
  let levels = 0
  while (rest.startsWith('../')) {
    levels++
    rest = rest.slice(3)
  }

  function makePath(parts: string[], prefix: string): string {
    let code = prefix
    for (const part of parts) {
      validateKey(part)
      code += `?.[${JSON.stringify(part)}]`
    }
    return code
  }

  if (levels > 0) {
    if (!rest || rest === 'this') return `__s[Math.max(0, __s.length - ${levels})]`
    if (rest === '@index' || rest === '@key') throw new Error(`Cannot access ${rest} from parent context`)
    const parts = rest.split('.')
    return makePath(parts, `__s[Math.max(0, __s.length - ${levels})]`)
  }

  if (expression === '@index') return '_i'
  if (expression === '@key') return '_keys[_i]'
  if (expression === 'this') return '__d'

  const parts = expression.split('.')
  return makePath(parts, '__d')
}

function genExpr(expr: ExprNode): string {
  switch (expr.type) {
    case 'Number':
      return String(expr.value)
    case 'String':
      return JSON.stringify(expr.value)
    case 'Boolean':
      return expr.value ? 'true' : 'false'
    case 'Null':
      return 'null'
    case 'Undefined':
      return 'undefined'
    case 'Identifier': {
      if (expr.path.length === 0) return 'undefined'
      if (expr.path.length === 1 && expr.path[0] === '@index') return '_i'
      if (expr.path.length === 1 && expr.path[0] === '@key') return '_keys[_i]'
      if (expr.path.length === 1 && expr.path[0] === 'this') return '__d'

      let levels = 0
      while (levels < expr.path.length && expr.path[levels] === '..') levels++
      if (levels > 0) {
        const rest = expr.path.slice(levels).join('.')
        if (!rest) return `__s[Math.max(0, __s.length - ${levels})]`
        const remaining = expr.path.slice(levels)
        let code = `__s[Math.max(0, __s.length - ${levels})]`
        for (const part of remaining) {
          validateKey(part)
          code += `?.[${JSON.stringify(part)}]`
        }
        return code
      }

      let code = '__d'
      for (const part of expr.path) {
        validateKey(part)
        code += `?.[${JSON.stringify(part)}]`
      }
      return code
    }
    case 'UnaryNot':
      return `(!${genExpr(expr.operand)})`
    case 'UnaryMinus':
      return `(-(${genExpr(expr.operand)}))`
    case 'BinaryOp':
      if (expr.op === '??') return `(${genExpr(expr.left)} ?? ${genExpr(expr.right)})`
      return `(${genExpr(expr.left)} ${expr.op} ${genExpr(expr.right)})`
    case 'CallExpression': {
      const callee = genExpr(expr.callee)
      const args = expr.args.map(a => genExpr(a)).join(', ')
      return `${callee}?.(${args})`
    }
    case 'Ternary':
      return `(${genExpr(expr.condition)} ? ${genExpr(expr.then)} : ${genExpr(expr.else)})`
    case 'ArrayLiteral': {
      const elems = expr.elements.map(e => genExpr(e)).join(', ')
      return `[${elems}]`
    }
    case 'ObjectLiteral': {
      const pairs = expr.entries.map(e => `${JSON.stringify(e.key)}: ${genExpr(e.value)}`).join(', ')
      return `{${pairs}}`
    }
  }
}
