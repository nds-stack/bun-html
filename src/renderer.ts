import type { ASTNode, ASTNodeIf, ASTNodeUnless, RenderOptions } from './types.js'
import { tokenize } from './lexer.js'
import { parse } from './parser.js'
import { evaluateExpr } from './expression.js'

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
    if (this.map.size >= this.max) {
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
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const templateCache = new BoundedCache<string, ASTNode[]>()
const partialCache = new BoundedCache<string, ASTNode[]>()

export function clearCache(): void {
  templateCache.clear()
  partialCache.clear()
}

export function purgeTemplate(template: string): boolean {
  return templateCache.delete(template)
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

  const ast = compile(template, opts)

  if (opts.partialsDir) {
    return renderAsync(ast, data, opts)
  }

  return renderSync(ast, data, opts)
}

function getConditionValue(
  node: ASTNodeIf | ASTNodeUnless,
  data: unknown,
  index?: number,
  key?: string,
): unknown {
  if (node.exprAst) {
    return evaluateExpr(node.exprAst, data, index, key)
  }
  return resolveValue(node.expression, data, index, key)
}

function renderSync(ast: ASTNode[], data: unknown, options: RenderOptions): string {
  let output = ''
  for (const node of ast) {
    output += renderNodeSync(node, data, options, {})
  }
  return output
}

function renderNodeSync(
  node: ASTNode,
  data: unknown,
  options: RenderOptions,
  ctx: { index?: number; key?: string },
): string {
  switch (node.type) {
    case 'Text':
      return node.value

    case 'Variable': {
      let value = resolveValue(node.expression, data, ctx.index, ctx.key)
      if (value === undefined) {
        const helper = options.helpers?.[node.expression]
        if (helper) value = helper.call(data)
      }
      if (value === null || value === undefined) return ''
      const str = String(value)
      return options.autoescape !== false ? Bun.escapeHTML(str) : str
    }

    case 'RawVariable': {
      const value = resolveValue(node.expression, data, ctx.index, ctx.key)
      if (value === null || value === undefined) return ''
      return String(value)
    }

    case 'Each': {
      const raw = resolveValue(node.expression, data, ctx.index, ctx.key)
      if (!raw || typeof raw !== 'object') return ''

      const entries = Array.isArray(raw) ? raw : Object.values(raw)
      const keys = Array.isArray(raw)
        ? entries.map((_, i) => String(i))
        : Object.keys(raw)

      let output = ''
      for (let i = 0; i < entries.length; i++) {
        for (const child of node.children) {
          output += renderNodeSync(child, entries[i], options, { index: i, key: keys[i] })
        }
      }
      return output
    }

    case 'If': {
      const value = getConditionValue(node, data, ctx.index, ctx.key)
      if (value) {
        let output = ''
        for (const child of node.children) {
          output += renderNodeSync(child, data, options, ctx)
        }
        return output
      }
      if (node.elseChildren.length > 0) {
        let output = ''
        for (const child of node.elseChildren) {
          output += renderNodeSync(child, data, options, ctx)
        }
        return output
      }
      return ''
    }

    case 'Unless': {
      const value = getConditionValue(node, data, ctx.index, ctx.key)
      if (!value) {
        let output = ''
        for (const child of node.children) {
          output += renderNodeSync(child, data, options, ctx)
        }
        return output
      }
      return ''
    }

    case 'Partial':
      throw new Error('Partials require partialsDir option')

    case 'Layout':
      throw new Error('Layouts require partialsDir option')
  }
}

async function renderAsync(ast: ASTNode[], data: unknown, options: RenderOptions): Promise<string> {
  let output = ''
  for (const node of ast) {
    output += await renderNodeAsync(node, data, options, {})
  }
  return output
}

async function renderNodeAsync(
  node: ASTNode,
  data: unknown,
  options: RenderOptions,
  ctx: { index?: number; key?: string },
): Promise<string> {
  switch (node.type) {
    case 'Text':
      return node.value

    case 'Variable': {
      let value = resolveValue(node.expression, data, ctx.index, ctx.key)
      if (value === undefined) {
        const helper = options.helpers?.[node.expression]
        if (helper) value = helper.call(data)
      }
      if (value === null || value === undefined) return ''
      const str = String(value)
      return options.autoescape !== false ? Bun.escapeHTML(str) : str
    }

    case 'RawVariable': {
      const value = resolveValue(node.expression, data, ctx.index, ctx.key)
      if (value === null || value === undefined) return ''
      return String(value)
    }

    case 'Each': {
      const raw = resolveValue(node.expression, data, ctx.index, ctx.key)
      if (!raw || typeof raw !== 'object') return ''

      const entries = Array.isArray(raw) ? raw : Object.values(raw)
      const keys = Array.isArray(raw)
        ? entries.map((_, i) => String(i))
        : Object.keys(raw)

      let output = ''
      for (let i = 0; i < entries.length; i++) {
        for (const child of node.children) {
          output += await renderNodeAsync(child, entries[i], options, { index: i, key: keys[i] })
        }
      }
      return output
    }

    case 'If': {
      const value = getConditionValue(node, data, ctx.index, ctx.key)
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
      const value = getConditionValue(node, data, ctx.index, ctx.key)
      if (!value) {
        let output = ''
        for (const child of node.children) {
          output += await renderNodeAsync(child, data, options, ctx)
        }
        return output
      }
      return ''
    }

    case 'Partial': {
      const dir = options.partialsDir
      if (!dir) throw new Error('Partials require partialsDir option')

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

function resolveValue(expression: string, data: unknown, index?: number, key?: string): unknown {
  if (expression === '@index') return index
  if (expression === '@key') return key
  if (expression === 'this') return data

  if (data === null || data === undefined) return undefined
  if (typeof data !== 'object') return undefined

  const parts = expression.split('.')
  let value: unknown = data
  for (const part of parts) {
    if (!isRecord(value)) return undefined
    value = value[part]
  }
  return value
}
