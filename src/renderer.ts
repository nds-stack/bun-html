import type { ASTNode, RenderOptions, CompiledTemplate, Plugin } from './types.js'
import { tokenize } from './lexer.js'
import { parse } from './parser.js'
import { compileToFunction } from './compiler.js'
import { renderAsync } from './runtime.js'
import { BoundedCache, type CacheStats } from './cache.js'

const MAX_TEMPLATE_LENGTH = 1_000_000
const NO_ESCAPE = (s: string): string => s

const templateCache = new BoundedCache<string, ASTNode[]>()
const compiledCache = new BoundedCache<string, CompiledTemplate>()

interface ProcessedPlugins {
  opts: RenderOptions
  tpl: string
  dt: Record<string, unknown>
}

function processPlugins(template: string, data: Record<string, unknown>, options: RenderOptions | undefined, plugins: Plugin[]): ProcessedPlugins {
  let mergedHelpers = options?.helpers
  let tpl = template
  let dt = data

  for (const plugin of plugins) {
    if (plugin.helpers) mergedHelpers = { ...mergedHelpers, ...plugin.helpers }
    if (plugin.beforeRender) {
      const r = plugin.beforeRender(tpl, dt, options ?? {})
      tpl = r.template; dt = r.data
    }
  }

  return { opts: { ...(options ?? {}), helpers: mergedHelpers }, tpl, dt }
}

function applyAfterRender(output: string, data: Record<string, unknown>, plugins: Plugin[]): string {
  for (const plugin of plugins) {
    if (plugin.afterRender) output = plugin.afterRender(output, data)
  }
  return output
}

export function clearCache(): void {
  templateCache.clear()
  compiledCache.clear()
}

export function purgeTemplate(template: string): boolean {
  const a = templateCache.delete(template)
  const b = compiledCache.delete(template)
  return a || b
}

export function getCacheStats(): { template: CacheStats; compiled: CacheStats } {
  return {
    template: templateCache.stats,
    compiled: compiledCache.stats,
  }
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
  if (template.length > MAX_TEMPLATE_LENGTH) throw new Error(`Template exceeds maximum length of ${MAX_TEMPLATE_LENGTH}`)

  const plugins = options?.plugins ?? []
  const { opts, tpl, dt } = processPlugins(template, data, options, plugins)

  if (opts.partialsDir) {
    const ast = compile(tpl, opts)
    return (async () => {
      let output = await renderAsync(ast, dt, opts)
      return applyAfterRender(output, dt, plugins)
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
  let output = fn(dt, opts.helpers, esc)
  return applyAfterRender(output, dt, plugins)
}

export function renderStream(
  template: string,
  data: Record<string, unknown>,
  options?: RenderOptions,
): ReadableStream<Uint8Array> {
  const plugins = options?.plugins ?? []
  const { opts, tpl, dt } = processPlugins(template, data, options, plugins)
  const ast = compile(tpl, opts)

  return new ReadableStream({
    async start(controller) {
      try {
        for (const node of ast) {
          const chunk = await renderAsync([node], dt, opts)
          if (chunk) {
            if (controller.desiredSize !== null && controller.desiredSize <= 0) {
              await Bun.sleep(0)
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
