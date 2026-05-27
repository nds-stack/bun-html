import type { ASTNode, RenderOptions, CompiledTemplate } from './types.js'
import { tokenize } from './lexer.js'
import { parse } from './parser.js'
import { compileToFunction } from './compiler.js'
import { renderAsync } from './runtime.js'
import { BoundedCache } from './cache.js'

const MAX_TEMPLATE_LENGTH = 1_000_000
const NO_ESCAPE = (s: string): string => s

const templateCache = new BoundedCache<string, ASTNode[]>()
const compiledCache = new BoundedCache<string, CompiledTemplate>()

export function clearCache(): void {
  templateCache.clear()
  compiledCache.clear()
}

export function purgeTemplate(template: string): boolean {
  const a = templateCache.delete(template)
  const b = compiledCache.delete(template)
  return a || b
}

export function compile(template: string, options?: RenderOptions): ASTNode[] {
  if (template.length > MAX_TEMPLATE_LENGTH) throw new Error(`Template exceeds maximum length of ${MAX_TEMPLATE_LENGTH}`)
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
  let opts: RenderOptions = options ?? {}

  const plugins = opts.plugins ?? []
  let mergedHelpers = opts.helpers
  let tpl = template
  let dt = data

  for (const plugin of plugins) {
    if (plugin.helpers) mergedHelpers = { ...mergedHelpers, ...plugin.helpers }
    if (plugin.beforeRender) {
      const r = plugin.beforeRender(tpl, dt, opts)
      tpl = r.template; dt = r.data
    }
  }

  opts = { ...opts, helpers: mergedHelpers }

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
      let ast = templateCache.get(tpl)
      if (!ast) { ast = parse(tokenize(tpl)); templateCache.set(tpl, ast) }
      fn = compileToFunction(ast)
      compiledCache.set(tpl, fn)
    }
  } else {
    let ast = templateCache.get(tpl) ?? parse(tokenize(tpl))
    fn = compileToFunction(ast)
  }

  const esc = opts.autoescape !== false ? Bun.escapeHTML : NO_ESCAPE
  let output = fn(dt, mergedHelpers, esc)

  for (const plugin of plugins) {
    if (plugin.afterRender) output = plugin.afterRender(output, dt)
  }
  return output
}

export function renderStream(
  template: string,
  data: Record<string, unknown>,
  options?: RenderOptions,
): ReadableStream<Uint8Array> {
  let opts: RenderOptions = options ?? {}

  const plugins = opts.plugins ?? []
  let mergedHelpers = opts.helpers
  let tpl = template
  let dt = data

  for (const plugin of plugins) {
    if (plugin.helpers) mergedHelpers = { ...mergedHelpers, ...plugin.helpers }
    if (plugin.beforeRender) {
      const r = plugin.beforeRender(tpl, dt, opts)
      tpl = r.template; dt = r.data
    }
  }

  opts = { ...opts, helpers: mergedHelpers }
  const ast = compile(tpl, opts)

  return new ReadableStream({
    async start(controller) {
      try {
        for (const node of ast) {
          const chunk = await renderAsync([node], dt, opts)
          if (chunk) {
            if (controller.desiredSize !== null && controller.desiredSize <= 0) {
              await new Promise(r => setTimeout(r, 0))
            }
            controller.enqueue(new TextEncoder().encode(chunk))
          }
        }
        controller.close()
      } catch (e) {
        controller.error(e instanceof Error ? e : new Error(String(e)))
      }
    },
  })
}
