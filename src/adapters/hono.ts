import type { RenderOptions } from '../types.js'
import { render } from '../renderer.js'

interface MinimalContext {
  set: (key: string, val: unknown) => void
}

interface HonoAdapterOptions {
  dir?: string
  cache?: boolean
  autoescape?: boolean
}

export function hono(options?: HonoAdapterOptions) {
  const baseOpts: RenderOptions = {
    partialsDir: options?.dir,
    cache: options?.cache,
    autoescape: options?.autoescape,
  }

  return async function renderer(c: MinimalContext, next: () => Promise<void>): Promise<void> {
    c.set('render', (template: string, data: Record<string, unknown>, extra?: Partial<RenderOptions>) => {
      return render(template, data, { ...baseOpts, ...extra })
    })
    await next()
  }
}
