// @ts-nocheck
import { bench, run } from 'bun:test'
import { render } from '../src/index.js'

const data = { name: 'World', items: ['apple', 'banana', 'cherry'] }
const tpl = '<h1>Hello {{name}}</h1><ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>'

bench('@nds-stack/bun-html (no cache)', () => {
  render(tpl, data, { cache: false })
})

bench('@nds-stack/bun-html (cached)', () => {
  render(tpl, data)
})

async function runCompetitors() {
  try {
    const { default: ejs } = await import('ejs')
    const ejsFn = ejs.compile('<h1>Hello <%= name %></h1><ul><% items.forEach(i => { %><li><%= i %></li><% }) %></ul>')
    bench('ejs', () => {
      ejsFn(data)
    })
  } catch {}

  try {
    const { default: handlebars } = await import('handlebars')
    const hbs = handlebars.compile('<h1>Hello {{name}}</h1><ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>')
    bench('handlebars', () => {
      hbs(data)
    })
  } catch {}

  try {
    const { default: mustache } = await import('mustache')
    bench('mustache', () => {
      mustache.render('<h1>Hello {{name}}</h1><ul>{{#items}}<li>{{.}}</li>{{/items}}</ul>', data)
    })
  } catch {}

  await run()
}

runCompetitors()
