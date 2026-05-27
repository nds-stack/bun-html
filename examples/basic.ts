import { render, renderStream, compileToFunction, compile, adapter } from '../src/index.js'

// Variable + auto-escape
console.log(render('<h1>Hello {{name}}!</h1>', { name: 'World' }))

// Raw output
console.log(render('<div>{{{html}}}</div>', { html: '<strong>bold</strong>' }))

// Loops with @index
console.log(render('<ul>{{#each items}}<li>{{@index}}: {{this}}</li>{{/each}}</ul>', {
  items: ['Apple', 'Banana', 'Cherry'],
}))

// Conditionals with expressions
console.log(render('{{#if role == "admin"}}ADMIN{{else}}USER{{/if}}', { role: 'admin' }))
console.log(render('{{#if age > 18 && role == "admin"}}Welcome{{/if}}', { age: 25, role: 'admin' }))

// Variable expressions
console.log(render('{{name.toUpperCase()}}', { name: 'alice' }))
console.log(render('{{price * qty}}', { price: 99, qty: 3 }))
console.log(render('{{age >= 18 ? "adult" : "minor"}}', { age: 20 }))

// Whitespace control
console.log(render('{{~#each items~}}{{this}}{{~/each~}}', { items: ['a', 'b', 'c'] }))

// Scoped context (#with)
console.log(render('{{#with user}}{{name}} ({{age}}){{/with}}', { user: { name: 'Alice', age: 30 } }))

// Parent context access
console.log(render('{{#each items}}{{../title}}: {{name}}\n{{/each}}', {
  title: 'Users', items: [{ name: 'A' }, { name: 'B' }],
}))

// Inline partials
console.log(render('{{#def "item"}}<li>{{name}}</li>{{/def}}<ul>{{#each items}}{{> item}}{{/each}}</ul>', {
  items: [{ name: 'A' }, { name: 'B' }],
}))

// Comments
console.log(render('Hello{{! this is a comment }}World', {}))

// Helpers
console.log(render('{{greet}}', { name: 'Alice' }, {
  helpers: { greet(this: unknown) { return `Hi, ${(this as Record<string, unknown>).name}` } },
}))

// Plugins
console.log(render('Hello {{name}}', { name: 'World' }, {
  plugins: [{
    name: 'upper',
    afterRender(output: string) { return output.toUpperCase() },
  }],
}))

// Compile + execute
const fn = compileToFunction(compile('Hello {{name}}!'))
console.log(fn({ name: 'Compiled' }, undefined, Bun.escapeHTML))

// Express adapter
const expressEngine = adapter.express({ dir: './views' })
console.log('Express engine:', typeof expressEngine)

// Hono adapter
const honoMw = adapter.hono()
console.log('Hono middleware:', typeof honoMw)

// Streaming SSR (drain async)
const stream = renderStream('<h1>{{title}}</h1>', { title: 'Streaming!' })
const reader = stream.getReader()
const decoder = new TextDecoder()
let result = ''
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  result += decoder.decode(value)
}
console.log(result)
