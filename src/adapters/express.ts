import type { RenderOptions } from '../types.js'
import { render } from '../renderer.js'

interface ExpressAdapterOptions {
  dir: string
  cache?: boolean
  autoescape?: boolean
}

export function express(options: ExpressAdapterOptions) {
  const opts: RenderOptions = {
    ...options,
    partialsDir: options.dir,
  }

  return function renderFile(
    filePath: string,
    data: Record<string, unknown>,
    callback: (err: Error | null, html?: string) => void,
  ): void {
    ;(async () => {
      try {
        const template = await Bun.file(filePath).text()
        const html = await render(template, data, opts)
        callback(null, html)
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)))
      }
    })()
  }
}
