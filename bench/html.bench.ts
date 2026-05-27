import { render } from '../src/index.js'

const data = { name: 'World', items: ['apple', 'banana', 'cherry'] }

const templates: { name: string; bun: string; ejs: string; hbs: string; mustache: string }[] = [
  {
    name: 'Variable',
    bun: 'Hello {{name}}',
    ejs: 'Hello <%= name %>',
    hbs: 'Hello {{name}}',
    mustache: 'Hello {{name}}',
  },
  {
    name: 'Loop (3 items)',
    bun: '<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>',
    ejs: '<ul><% items.forEach(i => { %><li><%= i %></li><% }) %></ul>',
    hbs: '<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>',
    mustache: '<ul>{{#items}}<li>{{.}}</li>{{/items}}</ul>',
  },
  {
    name: 'Conditional + expression',
    bun: '{{#if name == "World"}}Hello {{name}}{{/if}}',
    ejs: '<% if (name === "World") { %>Hello <%= name %><% } %>',
    hbs: '{{#if name}}Hello {{name}}{{/if}}',
    mustache: '{{#name}}Hello {{name}}{{/name}}',
  },
  {
    name: 'Combined',
    bun: '<h1>Hello {{name}}</h1><ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>{{#if name == "World"}}!{{/if}}',
    ejs: '<h1>Hello <%= name %></h1><ul><% items.forEach(i => { %><li><%= i %></li><% }) %></ul><% if (name === "World") { %>!<% } %>',
    hbs: '<h1>Hello {{name}}</h1><ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>{{#if name}}!{{/if}}',
    mustache: '<h1>Hello {{name}}</h1><ul>{{#items}}<li>{{.}}</li>{{/items}}</ul>{{#name}}!{{/name}}',
  },
]

function format(n: number): string {
  if (n > 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n > 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

async function bench(fn: () => string | Promise<string>, iterations = 5000): Promise<number> {
  for (let i = 0; i < 100; i++) fn()

  const start = performance.now()
  let i: number
  for (i = 0; i < iterations; i++) {
    if (i === 1000 && performance.now() - start > 10000) break
    fn()
  }
  const elapsed = performance.now() - start
  return Math.round(i / (elapsed / 1000))
}

async function main() {
  const ejsMod = await import('ejs').then(m => m.default).catch(() => null)
  const hbsMod = await import('handlebars').then(m => m.default).catch(() => null)
  const mustacheMod = await import('mustache').then(m => m.default).catch(() => null)

  const results: Record<string, Record<string, number>> = {}

  for (const tpl of templates) {
    const row: Record<string, number> = {}

    // Warmup cache separately
    render(tpl.bun, data)
    row['bun-nocache'] = await bench(() => render(tpl.bun, data, { cache: false }))
    row['bun-cached'] = await bench(() => render(tpl.bun, data))

    if (ejsMod) {
      const fn = ejsMod.compile(tpl.ejs)
      row['ejs'] = await bench(() => fn(data))
    }
    if (hbsMod) {
      const fn = hbsMod.compile(tpl.hbs)
      row['hbs'] = await bench(() => fn(data))
    }
    if (mustacheMod) {
      row['mustache'] = await bench(() => mustacheMod.render(tpl.mustache, data))
    }

    results[tpl.name] = row
  }

  console.log(`\nBenchmark: HTML template rendering (ops/sec, higher is better)\n`)

  const headers = ['Template', '@nds-stack/bun-html (cached)', '@nds-stack/bun-html (no cache)', 'ejs', 'handlebars', 'mustache']
  console.log(`| ${headers.join(' | ')} |`)
  console.log(`|${headers.map(() => '---').join('|')}|`)

  for (const tpl of templates) {
    const r = results[tpl.name]!
    console.log(
      `| ${tpl.name} | ${format(r['bun-cached'] ?? 0)} | ${format(r['bun-nocache'] ?? 0)} | ${format(r.ejs ?? 0)} | ${format(r.hbs ?? 0)} | ${format(r.mustache ?? 0)} |`,
    )
  }
  console.log()
}

main()
