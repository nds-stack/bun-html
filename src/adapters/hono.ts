import type { RenderOptions } from '../types.js'
import { render } from '../renderer.js'

interface HonoAdapterOptions {
  dir?: string
  cache?: boolean
  autoescape?: boolean
}

export function hono(options?: HonoAdapterOptions) {
  const baseOpts: RenderOptions = { ...options }

  return async function renderer(c: any, next: () => Promise<void>): Promise<void> {
    c.set('render', (template: string, data: Record<string, unknown>, extra?: Partial<RenderOptions>) => {
      return render(template, data, { ...baseOpts, ...extra })
    })
    await next()
  }
}
