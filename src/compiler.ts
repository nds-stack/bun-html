import type { ASTNode, ExprNode, CompiledTemplate } from './types.js'

export function compileToFunction(ast: ASTNode[]): CompiledTemplate {
  const body: string[] = []
  body.push('let $ = ""')
  body.push('let __d = data')
  body.push('let __h = helpers || {}')
  body.push('let __s = []')
  body.push('let __defs = {}')

  genNodes(ast, body)

  body.push('return $')

  const code = body.join('\n')
  return new Function('data', 'helpers', 'escapeHTML', code) as CompiledTemplate
}

function genNodes(nodes: ASTNode[], body: string[]): void {
  for (const node of nodes) {
    genNode(node, body)
  }
}

function genNode(node: ASTNode, body: string[]): void {
  switch (node.type) {
    case 'Text':
      body.push(`$ += ${JSON.stringify(node.value)}`)
      break

    case 'Variable':
      genVariable(node.expression, true, body)
      break

    case 'RawVariable':
      genVariable(node.expression, false, body)
      break

    case 'Each':
      genEach(node.expression, node.children, body)
      break

    case 'If': {
      const condCode = node.exprAst ? genExpr(node.exprAst) : `${genSafePath(node.expression)}`
      body.push(`if (${condCode}) {`)
      genNodes(node.children, body)
      if (node.elseChildren.length > 0) {
        body.push(`} else {`)
        genNodes(node.elseChildren, body)
      }
      body.push(`}`)
      break
    }

    case 'Unless': {
      const condCode = node.exprAst ? genExpr(node.exprAst) : `${genSafePath(node.expression)}`
      body.push(`if (!(${condCode})) {`)
      genNodes(node.children, body)
      body.push(`}`)
      break
    }

    case 'With': {
      body.push(`{`)
      body.push(`__s.push(__d)`)
      body.push(`let __with = __d${genPropPath(node.expression)}`)
      body.push(`if (__with != null && typeof __with === 'object') {`)
      body.push(`__d = __with`)
      genNodes(node.children, body)
      body.push(`}`)
      body.push(`__d = __s.pop()`)
      body.push(`}`)
      break
    }

    case 'PartialDef': {
      const subBody: string[] = []
      subBody.push('let $ = ""')
      genNodes(node.children, subBody)
      subBody.push('return $')
      body.push(`__defs[${JSON.stringify(node.name)}] = function() {\n${subBody.join('\n')}\n}`)
      break
    }

    case 'Partial': {
      body.push(`{`)
      body.push(`let __pfn = __defs[${JSON.stringify(node.name)}]`)
      body.push(`if (typeof __pfn === 'function') {`)
      body.push(`$ += __pfn()`)
      body.push(`} else {`)
      body.push(`throw new Error('Partial "${node.name}" not found. Define it via {{#def "${node.name}"}}...{{/def}} or set partialsDir.')`)
      body.push(`}`)
      body.push(`}`)
      break
    }

    case 'Layout':
      throw new Error('Layouts require partialsDir option')
  }
}

function genVariable(expression: string, escape: boolean, body: string[]): void {
  const path = genSafePath(expression)
  body.push(`{`)
  body.push(`let _v = ${path}`)
  body.push(`if (_v === void 0) {`)
  body.push(`let _hf = __h[${JSON.stringify(expression)}]`)
  body.push(`if (typeof _hf === 'function') _v = _hf.call(__d)`)
  body.push(`}`)
  body.push(`if (_v != null) $ += ${escape ? 'escapeHTML(String(_v))' : 'String(_v)'}`)
  body.push(`}`)
}

function genEach(expression: string, children: ASTNode[], body: string[]): void {
  const items = genSafePath(expression)
  body.push(`{`)
  body.push(`let _items = ${items}`)
  body.push(`if (_items && typeof _items === 'object') {`)
  body.push(`let _entries = Array.isArray(_items) ? _items : Object.values(_items)`)
  body.push(`let _keys = Array.isArray(_items) ? _entries.map((_, _i) => String(_i)) : Object.keys(_items)`)
  body.push(`for (let _i = 0; _i < _entries.length; _i++) {`)
  body.push(`__s.push(__d)`)
  body.push(`__d = _entries[_i]`)
  genNodes(children, body)
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

  if (levels > 0) {
    if (!rest || rest === 'this') return `__s[Math.max(0, __s.length - ${levels})]`
    if (rest === '@index' || rest === '@key') throw new Error(`Cannot access ${rest} from parent context`)
    const parts = rest.split('.')
    let code = `__s[Math.max(0, __s.length - ${levels})]`
    for (const part of parts) {
      code += `?.[${JSON.stringify(part)}]`
    }
    return code
  }

  if (expression === '@index') return '_i'
  if (expression === '@key') return '_keys[_i]'
  if (expression === 'this') return '__d'

  const parts = expression.split('.')
  let code = '__d'
  for (const part of parts) {
    code += `?.[${JSON.stringify(part)}]`
  }
  return code
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
          code += `?.[${JSON.stringify(part)}]`
        }
        return code
      }

      let code = '__d'
      for (const part of expr.path) {
        code += `?.[${JSON.stringify(part)}]`
      }
      return code
    }
    case 'UnaryNot':
      return `(!${genExpr(expr.operand)})`
    case 'BinaryOp':
      return `(${genExpr(expr.left)} ${expr.op} ${genExpr(expr.right)})`
  }
}
