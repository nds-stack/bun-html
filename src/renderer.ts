import type { ASTNode, ASTNodeIf, ASTNodeUnless, RenderOptions, CompiledTemplate } from './types.js'
import { tokenize } from './lexer.js'
import { parse } from './parser.js'
import { evaluateExpr } from './expression.js'
import { compileToFunction } from './compiler.js'

const DEFAULT_CACHE_SIZE = 100

class BoundedCache<K, V> {
  private max: number
  private map: Map<K, V>

  constructor(max: number = DEFAULT_CACHE_SIZE) {
    this.max = max
    this.map = new Map()
  }

  get(key: K): V | undefined {
    return this.map.get(key)
  }

  set(key: K, value: V): void {
    if (!this.map.has(key) && this.map.size >= this.max) {
      const first = this.map.keys().next().value
      if (first !== undefined) this.map.delete(first as unknown as K)
    }
    this.map.set(key, value)
  }

  delete(key: K): boolean {
    return this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }

  get size(): number {
    return this.map.size
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function validatePartialName(name: string): void {
  if (!name || /\.\.|[\\\/]/.test(name)) {
    throw new Error(`Invalid partial/layout name: "${name}"`)
  }
}

const templateCache = new BoundedCache<string, ASTNode[]>()
const compiledCache = new BoundedCache<string, CompiledTemplate>()
const partialCache = new BoundedCache<string, ASTNode[]>()

export function clearCache(): void {
  templateCache.clear()
  compiledCache.clear()
  partialCache.clear()
}

export function purgeTemplate(template: string): boolean {
  const a = templateCache.delete(template)
  const b = compiledCache.delete(template)
  return a || b
}

export function compile(template: string, options?: RenderOptions): ASTNode[] {
  const doCache = options?.cache !== false

  if (doCache) {
    const cached = templateCache.get(template)
    if (cached) return cached
  }

  const ast = parse(tokenize(template))

  if (doCache) {
    templateCache.set(template, ast)
  }

  return ast
}

export function render(
  template: string,
  data: Record<string, unknown>,
  options?: RenderOptions,
): string | Promise<string> {
  const opts: RenderOptions = options ?? {}

  const plugins = opts.plugins ?? []
  let mergedHelpers = opts.helpers
  let tpl = template
  let dt = data

  for (const plugin of plugins) {
    if (plugin.helpers) {
      mergedHelpers = { ...mergedHelpers, ...plugin.helpers }
    }
    if (plugin.beforeRender) {
      const result = plugin.beforeRender(tpl, dt, opts)
      tpl = result.template
      dt = result.data
    }
  }

  opts.helpers = mergedHelpers

  if (opts.partialsDir) {
    const ast = compile(tpl, opts)
    return (async () => {
      let output = await renderAsync(ast, dt, opts)
      for (const plugin of plugins) {
        if (plugin.afterRender) output = plugin.afterRender(output, dt)
      }
      return output
    })()
  }

  const doCache = opts.cache !== false
  let fn: CompiledTemplate | undefined

  if (doCache) {
    fn = compiledCache.get(tpl)
    if (!fn) {
      const ast = parse(tokenize(tpl))
      fn = compileToFunction(ast)
      compiledCache.set(tpl, fn)
    }
  } else {
    const ast = parse(tokenize(tpl))
    fn = compileToFunction(ast)
  }

  const esc = opts.autoescape !== false ? Bun.escapeHTML : (s: string): string => s
  let output = fn(dt, mergedHelpers, esc)

  for (const plugin of plugins) {
    if (plugin.afterRender) output = plugin.afterRender(output, dt)
  }
  return output
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

async function renderAsync(ast: ASTNode[], data: unknown, options: RenderOptions): Promise<string> {
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
      let value = resolveValue(node.expression, data, ctx.index, ctx.key, ctx.stack)
      if (value === undefined) {
        const helper = options.helpers?.[node.expression]
        if (helper) value = helper.call(data)
      }
      if (value === null || value === undefined) return ''
      const str = String(value)
      return options.autoescape !== false ? Bun.escapeHTML(str) : str
    }

    case 'RawVariable': {
      const value = resolveValue(node.expression, data, ctx.index, ctx.key, ctx.stack)
      if (value === null || value === undefined) return ''
      return String(value)
    }

    case 'Each': {
      const raw = resolveValue(node.expression, data, ctx.index, ctx.key, ctx.stack)
      if (!raw || typeof raw !== 'object') return ''

      const entries = Array.isArray(raw) ? raw : Object.values(raw)
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
      const sub = resolveValue(node.expression, data, ctx.index, ctx.key, ctx.stack)
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

function resolveValue(expression: string, data: unknown, index?: number, key?: string, stack?: unknown[]): unknown {
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
    if (!isRecord(value)) return undefined
    value = value[part]
  }
  return value
}
