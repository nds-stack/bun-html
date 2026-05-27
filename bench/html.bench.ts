import { render } from '../src/index.js'

const data = { name: 'World', items: ['apple', 'banana', 'cherry'] }
const MB = 1024 * 1024

interface TemplateSet {
  name: string
  bun: string
  ejs: string
  hbs: string
  mustache: string
  njk: string
}

const templates: TemplateSet[] = [
  {
    name: 'Variable',
    bun: 'Hello {{name}}',
    ejs: 'Hello <%= name %>',
    hbs: 'Hello {{name}}',
    mustache: 'Hello {{name}}',
    njk: 'Hello {{name}}',
  },
  {
    name: 'Loop (3 items)',
    bun: '<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>',
    ejs: '<ul><% items.forEach(i => { %><li><%= i %></li><% }) %></ul>',
    hbs: '<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>',
    mustache: '<ul>{{#items}}<li>{{.}}</li>{{/items}}</ul>',
    njk: '<ul>{% for item in items %}<li>{{ item }}</li>{% endfor %}</ul>',
  },
  {
    name: 'Conditional + expression',
    bun: '{{#if name == "World"}}Hello {{name}}{{/if}}',
    ejs: '<% if (name === "World") { %>Hello <%= name %><% } %>',
    hbs: '{{#if name}}Hello {{name}}{{/if}}',
    mustache: '{{#name}}Hello {{name}}{{/name}}',
    njk: '{% if name == "World" %}Hello {{name}}{% endif %}',
  },
  {
    name: 'Combined',
    bun: '<h1>Hello {{name}}</h1><ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>{{#if name == "World"}}!{{/if}}',
    ejs: '<h1>Hello <%= name %></h1><ul><% items.forEach(i => { %><li><%= i %></li><% }) %></ul><% if (name === "World") { %>!<% } %>',
    hbs: '<h1>Hello {{name}}</h1><ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>{{#if name}}!{{/if}}',
    mustache: '<h1>Hello {{name}}</h1><ul>{{#items}}<li>{{.}}</li>{{/items}}</ul>{{#name}}!{{/name}}',
    njk: '<h1>Hello {{name}}</h1><ul>{% for item in items %}<li>{{ item }}</li>{% endfor %}</ul>{% if name == "World" %}!{% endif %}',
  },
]

function format(n: number): string {
  if (n > 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n > 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

function formatMB(bytes: number): string {
  return (bytes / MB).toFixed(2)
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
  let njkMod: any = null; try { njkMod = (await import('nunjucks')).default } catch {}

  const results: Record<string, Record<string, number>> = {}

  for (const tpl of templates) {
    const row: Record<string, number> = {}

    render(tpl.bun, data)
    row['bun'] = await bench(() => render(tpl.bun, data))

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
    if (njkMod) {
      njkMod.configure({ autoescape: false })
      row['nunjucks'] = await bench(() => njkMod.renderString(tpl.njk, data))
    }

    results[tpl.name] = row
  }

  console.log(`\nBenchmark: HTML template rendering (ops/sec, higher is better)\n`)
  console.log(`All libraries use their default rendering mode (pre-compiled where available).`)
  console.log(`\n| Template | @nds-stack/bun-html | ejs | handlebars | mustache | nunjucks |`)
  console.log(`|---|---|---|---|---|---|`)

  for (const tpl of templates) {
    const r = results[tpl.name]!
    console.log(
      `| ${tpl.name} | ${format(r.bun ?? 0)} | ${format(r.ejs ?? 0)} | ${format(r.hbs ?? 0)} | ${format(r.mustache ?? 0)} | ${format(r.nunjucks ?? 0)} |`,
    )
  }
  console.log()

  console.log(`\nMemory usage (first render):\n`)
  console.log(`| Library | Heap Used (MB) |`)
  console.log(`|---|---|`)

  const libs: { name: string; render: () => string | Promise<string> }[] = [
    { name: 'bun-html', render: () => render('<h1>{{name}}</h1><ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>', data) },
  ]
  if (ejsMod) libs.push({ name: 'ejs', render: () => ejsMod.render('<h1><%= name %></h1><ul><% items.forEach(i => { %><li><%= i %></li><% }) %></ul>', data) })
  if (hbsMod) libs.push({ name: 'handlebars', render: () => hbsMod.compile('<h1>{{name}}</h1><ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>')(data) })
  if (mustacheMod) libs.push({ name: 'mustache', render: () => mustacheMod.render('<h1>{{name}}</h1><ul>{{#items}}<li>{{.}}</li>{{/items}}</ul>', data) })
  if (njkMod) { njkMod.configure({ autoescape: false }); libs.push({ name: 'nunjucks', render: () => njkMod.renderString('<h1>{{name}}</h1><ul>{% for item in items %}<li>{{ item }}</li>{% endfor %}</ul>', data) }) }

  for (const lib of libs) {
    if (global.gc) global.gc()
    const before = process.memoryUsage().heapUsed
    await lib.render()
    const after = process.memoryUsage().heapUsed
    console.log(`| ${lib.name} | ${formatMB(after - before)} |`)
  }

  console.log(`\nStartup time (first render, ms):\n`)
  console.log(`| Library | Cold (ms) | Warm (ms) |`)
  console.log(`|---|---|---|`)
  for (const lib of libs) {
    const tpl = '<h1>{{name}}</h1><ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>'
    if (lib.name === 'bun-html') {
      const s1 = performance.now(); render(tpl, data); const e1 = performance.now()
      const s2 = performance.now(); render(tpl, data); const e2 = performance.now()
      console.log(`| ${lib.name} | ${((e1 - s1)).toFixed(2)} | ${((e2 - s2)).toFixed(2)} |`)
    } else {
      const s1 = performance.now(); await lib.render(); const e1 = performance.now()
      const s2 = performance.now(); await lib.render(); const e2 = performance.now()
      console.log(`| ${lib.name} | ${((e1 - s1)).toFixed(2)} | ${((e2 - s2)).toFixed(2)} |`)
    }
  }
  console.log()
}

main()
