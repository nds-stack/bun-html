import type { ASTNode, RenderOptions } from './types.js'
import { tokenize } from './lexer.js'
import { parse } from './parser.js'

const templateCache = new Map<string, ASTNode[]>()
const partialCache = new Map<string, ASTNode[]>()

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
      const value = resolveValue(node.expression, data, ctx.index, ctx.key)
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
      const value = resolveValue(node.expression, data, ctx.index, ctx.key)
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
      const value = resolveValue(node.expression, data, ctx.index, ctx.key)
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
      const value = resolveValue(node.expression, data, ctx.index, ctx.key)
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

      const layoutData = typeof data === 'object' && data !== null
        ? { ...(data as Record<string, unknown>), content }
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
    if (value === null || value === undefined) return undefined
    if (typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[part]
  }
  return value
}
