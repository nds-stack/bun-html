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
  for (let i = 0; i < 100; i++) await fn()

  const start = performance.now()
  let i: number
  for (i = 0; i < iterations; i++) {
    if (i === 1000 && performance.now() - start > 10000) break
    await fn()
  }
  const elapsed = performance.now() - start
  return Math.round(i / (elapsed / 1000))
}

async function main() {
  let ejsMod: any = null; try { ejsMod = (await import('ejs')).default } catch {}
  let hbsMod: any = null; try { hbsMod = (await import('handlebars')).default } catch {}
  let mustacheMod: any = null; try { mustacheMod = (await import('mustache')).default } catch {}

  const results: Record<string, Record<string, number>> = {}

  for (const tpl of templates) {
    const row: Record<string, number> = {}

    // bun-html default mode (cache: true) — compile once via new Function()
    render(tpl.bun, data)
    row['bun'] = await bench(() => render(tpl.bun, data))

    if (ejsMod) {
      // ejs compile() returns a JS function — pre-compiled
      const fn = ejsMod.compile(tpl.ejs)
      row['ejs'] = await bench(() => fn(data))
    }
    if (hbsMod) {
      // Handlebars compile() returns a JS function — pre-compiled
      const fn = hbsMod.compile(tpl.hbs)
      row['hbs'] = await bench(() => fn(data))
    }
    if (mustacheMod) {
      // Mustache has no separate compile — parse + render every call
      row['mustache'] = await bench(() => mustacheMod.render(tpl.mustache, data))
    }

    results[tpl.name] = row
  }

  console.log(`\nBenchmark: HTML template rendering (ops/sec, higher is better)\n`)
  console.log(`All libraries use their default rendering mode (pre-compiled where available).`)
  console.log(`\n| Template | @nds-stack/bun-html | ejs | handlebars | mustache |`)
  console.log(`|---|---|---|---|---|`)

  for (const tpl of templates) {
    const r = results[tpl.name]!
    console.log(
      `| ${tpl.name} | ${format(r.bun ?? 0)} | ${format(r.ejs ?? 0)} | ${format(r.hbs ?? 0)} | ${format(r.mustache ?? 0)} |`,
    )
  }
  console.log()
}

main()
