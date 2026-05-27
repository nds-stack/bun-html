import type { ASTNode, ASTNodeIf, ASTNodeUnless, ASTNodeVariable, ASTNodeRawVariable, PipeFilter, RenderOptions } from './types.js'
import { evaluateExpr } from './evaluator.js'
import { validateKey } from './types.js'
import { tokenize } from './lexer.js'
import { parse } from './parser.js'
import { BoundedCache } from './cache.js'

const partialCache = new BoundedCache<string, ASTNode[]>()

export function clearPartials(): void {
  partialCache.clear()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function validatePartialName(name: string): void {
  if (!name || /\.\.|[\\\/]/.test(name)) {
    throw new Error(`Invalid partial/layout name: "${name}"`)
  }
}

function resolveOrEval(
  node: ASTNodeVariable | ASTNodeRawVariable,
  data: unknown,
  index?: number,
  key?: string,
  stack?: unknown[],
): unknown {
  if (node.exprAst) {
    return evaluateExpr(node.exprAst, data, index, key, stack)
  }
  return resolveValue(node.expression, data, index, key, stack)
}

function applyFilter(filter: PipeFilter, value: unknown, options: RenderOptions): unknown {
  const fn = options.helpers?.[filter.name]
  if (typeof fn !== 'function') return value
  return fn.call(value, ...filter.args)
}

function getConditionValue(
  node: ASTNodeIf | ASTNodeUnless,
  data: unknown,
  index?: number,
  key?: string,
  stack?: unknown[],
): unknown {
  if (node.exprAst) {
    return evaluateExpr(node.exprAst, data, index, key, stack)
  }
  return resolveValue(node.expression, data, index, key, stack)
}

export async function renderAsync(ast: ASTNode[], data: unknown, options: RenderOptions): Promise<string> {
  let output = ''
  for (const node of ast) {
    output += await renderNodeAsync(node, data, options, { stack: [data], defs: {} })
  }
  return output
}

async function renderNodeAsync(
  node: ASTNode,
  data: unknown,
  options: RenderOptions,
  ctx: { index?: number; key?: string; stack?: unknown[]; defs?: Record<string, ASTNode[]> },
): Promise<string> {
  switch (node.type) {
    case 'Text':
      return node.value

    case 'Variable': {
      let value = resolveOrEval(node, data, ctx.index, ctx.key, ctx.stack)
      if (node.filters && node.filters.length > 0 && value != null) {
        for (const filter of node.filters) {
          value = applyFilter(filter, value, options)
        }
      }
      if (value === undefined && !node.exprAst) {
        const helper = options.helpers?.[node.expression]
        if (helper) value = helper.call(data)
      }
      if (value === null || value === undefined) return ''
      const str = String(value)
      return options.autoescape !== false ? Bun.escapeHTML(str) : str
    }

    case 'RawVariable': {
      let value = resolveOrEval(node, data, ctx.index, ctx.key, ctx.stack)
      if (node.filters && node.filters.length > 0 && value != null) {
        for (const filter of node.filters) {
          value = applyFilter(filter, value, options)
        }
      }
      if (value === null || value === undefined) return ''
      return String(value)
    }

    case 'Each': {
      const raw = node.exprAst
        ? evaluateExpr(node.exprAst, data, ctx.index, ctx.key, ctx.stack)
        : resolveValue(node.expression, data, ctx.index, ctx.key, ctx.stack)
      if (!raw || typeof raw !== 'object') return ''

      const entries = Object.values(raw)
      const keys = Array.isArray(raw)
        ? entries.map((_, i) => String(i))
        : Object.keys(raw)

      let output = ''
      for (let i = 0; i < entries.length; i++) {
        const newCtx = { index: i, key: keys[i], stack: [...(ctx.stack ?? []), data], defs: ctx.defs }
        for (const child of node.children) {
          output += await renderNodeAsync(child, entries[i], options, newCtx)
        }
      }
      return output
    }

    case 'If': {
      const value = getConditionValue(node, data, ctx.index, ctx.key, ctx.stack)
      if (value) {
        let output = ''
        for (const child of node.children) {
          output += await renderNodeAsync(child, data, options, ctx)
        }
        return output
      }
      if (node.elseChildren.length > 0) {
        let output = ''
        for (const child of node.elseChildren) {
          output += await renderNodeAsync(child, data, options, ctx)
        }
        return output
      }
      return ''
    }

    case 'Unless': {
      const value = getConditionValue(node, data, ctx.index, ctx.key, ctx.stack)
      if (!value) {
        let output = ''
        for (const child of node.children) {
          output += await renderNodeAsync(child, data, options, ctx)
        }
        return output
      }
      return ''
    }

    case 'With': {
      const sub = node.exprAst
        ? evaluateExpr(node.exprAst, data, ctx.index, ctx.key, ctx.stack)
        : resolveValue(node.expression, data, ctx.index, ctx.key, ctx.stack)
      if (sub === null || sub === undefined || typeof sub !== 'object') return ''
      let output = ''
      const newCtx = { stack: [...(ctx.stack ?? []), data], defs: ctx.defs }
      for (const child of node.children) {
        output += await renderNodeAsync(child, sub, options, newCtx)
      }
      return output
    }

    case 'PartialDef': {
      if (!ctx.defs) ctx.defs = {}
      ctx.defs[node.name] = node.children
      return ''
    }

    case 'Partial': {
      const defs = ctx.defs?.[node.name]
      if (defs) {
        let output = ''
        for (const child of defs) {
          output += await renderNodeAsync(child, data, options, ctx)
        }
        return output
      }
      const dir = options.partialsDir
      if (!dir) throw new Error('Partials require partialsDir option')
      validatePartialName(node.name)

      const cacheKey = `${dir}/${node.name}`
      let partialAst: ASTNode[]
      const cached = partialCache.get(cacheKey)
      if (cached) {
        partialAst = cached
      } else {
        const file = Bun.file(`${dir}/${node.name}.html`)
        const content = await file.text()
        partialAst = parse(tokenize(content))
        partialCache.set(cacheKey, partialAst)
      }

      let output = ''
      for (const child of partialAst) {
        output += await renderNodeAsync(child, data, options, ctx)
      }
      return output
    }

    case 'Layout': {
      const dir = options.partialsDir
      if (!dir) throw new Error('Layouts require partialsDir option')
      validatePartialName(node.name)

      let content = ''
      for (const child of node.children) {
        content += await renderNodeAsync(child, data, options, ctx)
      }

      const cacheKey = `${dir}/${node.name}`
      let layoutAst: ASTNode[]
      const cached = partialCache.get(cacheKey)
      if (cached) {
        layoutAst = cached
      } else {
        const file = Bun.file(`${dir}/${node.name}.html`)
        const layoutContent = await file.text()
        layoutAst = parse(tokenize(layoutContent))
        partialCache.set(cacheKey, layoutAst)
      }

      const layoutData = isRecord(data)
        ? { ...data, content }
        : { this: data, content }

      let output = ''
      for (const child of layoutAst) {
        output += await renderNodeAsync(child, layoutData, options, ctx)
      }
      return output
    }
  }
}

export function resolveValue(expression: string, data: unknown, index?: number, key?: string, stack?: unknown[]): unknown {
  if (!expression) return undefined
  if (expression === '@index') return index
  if (expression === '@key') return key
  if (expression === 'this') return data

  if (data === null || data === undefined) return undefined
  if (typeof data !== 'object') return undefined

  let rest = expression
  let levels = 0
  while (rest.startsWith('../')) {
    levels++
    rest = rest.slice(3)
  }

  let value: unknown
  if (levels > 0) {
    if (!stack || stack.length < levels) return undefined
    value = stack[stack.length - levels]
  } else {
    value = data
  }

  if (!rest) return value

  const parts = rest.split('.')
  for (const part of parts) {
    validateKey(part)
    if (!isRecord(value)) return undefined
    value = value[part]
  }
  return value
}
