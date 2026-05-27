import { render } from '../src/index.js'

const data = { name: 'World', items: ['apple', 'banana', 'cherry'] }
const tpl = '<h1>Hello {{name}}</h1><ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>'

function format(n: number): string {
  if (n > 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n > 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

async function bench(_label: string, fn: () => string | Promise<string>, iterations = 5000): Promise<number> {
  // warmup
  for (let i = 0; i < 100; i++) fn()

  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    if (i === 1000 && performance.now() - start > 10000) break
    fn()
  }
  const elapsed = performance.now() - start
  const ops = Math.round(iterations / (elapsed / 1000))
  return ops
}

async function main() {
  const results: Record<string, number> = {}

  results['@nds-stack/bun-html (no cache)'] = await bench('no cache', () => render(tpl, data, { cache: false }))
  results['@nds-stack/bun-html (cached)'] = await bench('cached', () => render(tpl, data))

  try {
    const { default: ejs } = await import('ejs')
    const ejsFn = ejs.compile('<h1>Hello <%= name %></h1><ul><% items.forEach(i => { %><li><%= i %></li><% }) %></ul>')
    results['ejs'] = await bench('ejs', () => ejsFn(data))
  } catch {}

  try {
    const { default: handlebars } = await import('handlebars')
    const hbs = handlebars.compile('<h1>Hello {{name}}</h1><ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>')
    results['handlebars'] = await bench('handlebars', () => hbs(data))
  } catch {}

  try {
    const { default: mustache } = await import('mustache')
    results['mustache'] = await bench('mustache', () =>
      mustache.render('<h1>Hello {{name}}</h1><ul>{{#items}}<li>{{.}}</li>{{/items}}</ul>', data),
    )
  } catch {}

  console.log(`\nBenchmark: HTML template rendering (ops/sec, higher is better)\n`)
  console.log(`| Library | Throughput | vs bun-html (cached) |`)
  console.log(`|---------|------------|---------------------|`)
  const baseline = results['@nds-stack/bun-html (cached)']
  for (const [name, ops] of Object.entries(results)) {
    const pct = baseline ? (((ops - baseline) / baseline) * 100).toFixed(0) : '-'
    const pctStr = name === '@nds-stack/bun-html (cached)' ? '-' : `${pct > '0' ? '+' : ''}${pct}%`
    console.log(`| ${name} | ${format(ops)} ops/s | ${pctStr} |`)
  }
  console.log()
}

main()
