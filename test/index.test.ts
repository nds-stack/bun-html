import { describe, test, expect } from 'bun:test'
import { render, compile, renderStream } from '../src/index.js'

describe('bun-html', () => {

  test('basic variable interpolation', () => {
    const result = render('Hello {{name}}!', { name: 'World' })
    expect(result).toBe('Hello World!')
  })

  test('auto-escape HTML characters', () => {
    const result = render('{{content}}', { content: '<script>alert("xss")</script>' })
    expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
  })

  test('raw {{{var}}} no escape', () => {
    const result = render('{{{content}}}', { content: '<strong>bold</strong>' })
    expect(result).toBe('<strong>bold</strong>')
  })

  test('{{#each}} loop with {{this}}', () => {
    const result = render('{{#each items}}<{{this}}>{{/each}}', { items: ['a', 'b', 'c'] })
    expect(result).toBe('<a><b><c>')
  })

  test('{{#each}} loop with object properties and @index', () => {
    const result = render('{{#each items}}{{@index}}:{{name}},{{/each}}', {
      items: [{ name: 'Alice' }, { name: 'Bob' }],
    })
    expect(result).toBe('0:Alice,1:Bob,')
  })

  test('{{#each}} over object with @key', () => {
    const result = render('{{#each items}}{{@key}}:{{this}},{{/each}}', {
      items: { x: 'X', y: 'Y' },
    })
    expect(result).toBe('x:X,y:Y,')
  })

  test('{{#if}} conditional truthy', () => {
    const result = render('{{#if show}}visible{{/if}}', { show: true })
    expect(result).toBe('visible')
  })

  test('{{#if}} conditional falsy', () => {
    const result = render('{{#if show}}visible{{/if}}', { show: false })
    expect(result).toBe('')
  })

  test('{{#if}}/{{else}}', () => {
    const result = render('{{#if active}}on{{else}}off{{/if}}', { active: false })
    expect(result).toBe('off')
  })

  test('{{#unless}} shows when condition is false', () => {
    const result = render('{{#unless hidden}}shown{{/unless}}', { hidden: false })
    expect(result).toBe('shown')
  })

  test('{{#unless}} hides when condition is true', () => {
    const result = render('{{#unless hidden}}hidden{{/unless}}', { hidden: true })
    expect(result).toBe('')
  })

  test('nested context dot notation', () => {
    const result = render('{{user.name}} is {{user.age}}', {
      user: { name: 'Alice', age: 30 },
    })
    expect(result).toBe('Alice is 30')
  })

  test('missing variable returns empty string', () => {
    const result = render('{{missing}}', {})
    expect(result).toBe('')
  })

  test('undefined value renders empty string', () => {
    const result = render('{{name}}', { name: undefined })
    expect(result).toBe('')
  })

  test('null value renders empty string', () => {
    const result = render('{{value}}', { value: null })
    expect(result).toBe('')
  })

  test('auto-escape can be disabled', () => {
    const result = render('{{html}}', { html: '<br>' }, { autoescape: false })
    expect(result).toBe('<br>')
  })

  test('text outside tags is preserved', () => {
    const result = render('before {{name}} after', { name: 'test' })
    expect(result).toBe('before test after')
  })

  test('zero and false are rendered as strings', () => {
    expect(render('{{val}}', { val: 0 })).toBe('0')
    expect(render('{{val}}', { val: false })).toBe('false')
  })

  test('{{#each}} with empty array renders nothing', () => {
    const result = render('{{#each items}}x{{/each}}', { items: [] })
    expect(result).toBe('')
  })

  test('nested {{#each}} loops', () => {
    const result = render('{{#each rows}}{{#each this}}({{this}}){{/each}}{{/each}}', {
      rows: [['a', 'b'], ['c', 'd']],
    })
    expect(result).toBe('(a)(b)(c)(d)')
  })

  test('template cache works', () => {
    const data = { name: 'World' }
    const r1 = render('Hello {{name}}', data)
    const r2 = render('Hello {{name}}', data)
    expect(r1).toBe(r2)
  })

  test('helpers can transform values', () => {
    const result = render('{{greet}}', { name: 'World' }, {
      helpers: {
        greet(this: unknown): string {
          const d = this as Record<string, unknown>
          return `Hello, ${String(d.name)}!`
        },
      },
    })
    expect(result).toBe('Hello, World!')
  })

  test('compile returns AST array', () => {
    const ast = compile('{{name}}')
    expect(Array.isArray(ast)).toBe(true)
    expect(ast.length).toBeGreaterThan(0)
  })

  test('{{#each}} with {{@key}} and {{@index}} on array', () => {
    const result = render('{{#each items}}{{@index}}-{{@key}}:{{this}}|{{/each}}', {
      items: ['a', 'b'],
    })
    expect(result).toBe('0-0:a|1-1:b|')
  })

  test('whitespace control: strip after tag', () => {
    const result = render('a {{~b}} c', { b: 'B' })
    expect(result).toBe('aB c')
  })

  test('whitespace control: strip before tag', () => {
    const result = render('a {{b~}} c', { b: 'B' })
    expect(result).toBe('a Bc')
  })

  test('whitespace control: strip both sides', () => {
    const result = render('a {{~b~}} c', { b: 'B' })
    expect(result).toBe('aBc')
  })

  test('whitespace control: strip around block tags', () => {
    const result = render('before {{~#if show~}}\n  visible\n{{~/if~}} after', { show: true })
    expect(result).toBe('beforevisibleafter')
  })

  test('whitespace control: strip around each loop', () => {
    const result = render('{{~#each items~}}\n  {{this}}\n{{~/each~}}', { items: ['a', 'b'] })
    expect(result).toBe('ab')
  })

  test('whitespace control: no strip when tilde absent', () => {
    const result = render('a {{b}} c', { b: 'B' })
    expect(result).toBe('a B c')
  })

  test('expression: comparison in {{#if}}', () => {
    expect(render('{{#if age > 18}}adult{{/if}}', { age: 25 })).toBe('adult')
    expect(render('{{#if age > 18}}adult{{/if}}', { age: 15 })).toBe('')
  })

  test('expression: multiple comparisons in {{#if}}', () => {
    expect(render('{{#if age >= 18}}adult{{/if}}', { age: 18 })).toBe('adult')
    expect(render('{{#if age < 18}}minor{{/if}}', { age: 15 })).toBe('minor')
    expect(render('{{#if age <= 12}}kid{{/if}}', { age: 12 })).toBe('kid')
  })

  test('expression: equality in {{#if}}', () => {
    expect(render('{{#if role == "admin"}}ADMIN{{/if}}', { role: 'admin' })).toBe('ADMIN')
    expect(render('{{#if role == "admin"}}ADMIN{{/if}}', { role: 'user' })).toBe('')
    expect(render('{{#if role != "admin"}}user{{/if}}', { role: 'user' })).toBe('user')
  })

  test('expression: logical AND in {{#if}}', () => {
    expect(render('{{#if active && admin}}yes{{/if}}', { active: true, admin: true })).toBe('yes')
    expect(render('{{#if active && admin}}yes{{/if}}', { active: true, admin: false })).toBe('')
  })

  test('expression: logical OR in {{#if}}', () => {
    expect(render('{{#if admin || moderator}}access{{/if}}', { admin: false, moderator: true })).toBe('access')
    expect(render('{{#if admin || moderator}}access{{/if}}', { admin: false, moderator: false })).toBe('')
  })

  test('expression: negation in {{#if}}', () => {
    expect(render('{{#if !disabled}}active{{/if}}', { disabled: false })).toBe('active')
    expect(render('{{#if !disabled}}active{{/if}}', { disabled: true })).toBe('')
  })

  test('expression: parentheses in {{#if}}', () => {
    expect(render('{{#if (age > 18) && (role == "admin")}}yes{{/if}}', { age: 25, role: 'admin' })).toBe('yes')
  })

  test('expression: combined with whitespace control', () => {
    const result = render('{{~#if age > 18~}}\n  adult\n{{~/if~}}', { age: 25 })
    expect(result).toBe('adult')
  })

  test('expression: {{#unless}} with comparison', () => {
    expect(render('{{#unless age >= 18}}minor{{/unless}}', { age: 15 })).toBe('minor')
    expect(render('{{#unless age >= 18}}minor{{/unless}}', { age: 20 })).toBe('')
  })

  test('expression: truthy variable as condition (backward compat)', () => {
    expect(render('{{#if show}}yes{{/if}}', { show: true })).toBe('yes')
    expect(render('{{#if user}}yes{{/if}}', { user: { name: 'A' } })).toBe('yes')
    expect(render('{{#if items.length}}has items{{/if}}', { items: [1, 2] })).toBe('has items')
  })

  test('comment {{! ... }} is stripped', () => {
    expect(render('Hello{{! comment }}World', {})).toBe('HelloWorld')
  })

  test('comment with multiple lines', () => {
    expect(render('a{{! multi\nline }}b', {})).toBe('ab')
  })

  test('comment does not affect surrounding whitespace', () => {
    expect(render('a {{! note }} b', {})).toBe('a  b')
  })

  test('{{#with}} scopes data context', () => {
    const result = render('{{#with user}}{{name}}{{/with}}', { user: { name: 'Alice' } })
    expect(result).toBe('Alice')
  })

  test('{{#with}} nested', () => {
    const result = render('{{#with a}}{{#with b}}{{name}}{{/with}}{{/with}}', {
      a: { b: { name: 'deep' } },
    })
    expect(result).toBe('deep')
  })

  test('{{#with}} on non-object renders nothing', () => {
    expect(render('{{#with missing}}x{{/with}}', {})).toBe('')
  })

  test('adapter.express returns renderFile function', async () => {
    const { adapter } = await import('../src/index.js')
    const eng = adapter.express({ dir: './views' })
    expect(typeof eng).toBe('function')
    expect(eng.length).toBe(3)
  })

  test('adapter.hono returns middleware function', async () => {
    const { adapter } = await import('../src/index.js')
    const mw = adapter.hono()
    expect(typeof mw).toBe('function')
    expect(mw.length).toBe(2)
  })

  test('{{#with}} inside {{#each}}', () => {
    const result = render('{{#each items}}{{#with this}}{{name}}{{/with}}{{/each}}', {
      items: [{ name: 'A' }, { name: 'B' }],
    })
    expect(result).toBe('AB')
  })

  test('parent context {{../var}} inside each', () => {
    const result = render('{{#each items}}{{../title}}: {{name}},{{/each}}', {
      title: 'Users',
      items: [{ name: 'Alice' }, { name: 'Bob' }],
    })
    expect(result).toBe('Users: Alice,Users: Bob,')
  })

  test('parent context {{../var}} inside with', () => {
    const result = render('{{#with user}}{{../greeting}}, {{name}}!{{/with}}', {
      greeting: 'Hello',
      user: { name: 'World' },
    })
    expect(result).toBe('Hello, World!')
  })

  test('parent context {{../../var}} nested each', () => {
    const result = render('{{#each groups}}{{#each items}}{{../../title}}: {{../name}} - {{this}},{{/each}}{{/each}}', {
      title: 'List',
      groups: [{ name: 'Group A', items: ['a1', 'a2'] }],
    })
    expect(result).toBe('List: Group A - a1,List: Group A - a2,')
  })

  test('parent context in {{#if ../cond}}', () => {
    const result = render('{{#each items}}{{#if ../show}}{{name}}{{/if}}{{/each}}', {
      show: true,
      items: [{ name: 'A' }, { name: 'B' }],
    })
    expect(result).toBe('AB')
  })

  test('parent context combined with expression {{#if ../count > 1}}', () => {
    const result = render('{{#each items}}{{#if ../count > 1}}{{name}}{{/if}}{{/each}}', {
      count: 2,
      items: [{ name: 'A' }, { name: 'B' }],
    })
    expect(result).toBe('AB')
  })

  test('inline partial {{#def}} renders via {{> name}}', () => {
    const result = render('{{#def "item"}}<li>{{name}}</li>{{/def}}{{#each items}}{{> item}}{{/each}}', {
      items: [{ name: 'A' }, { name: 'B' }],
    })
    expect(result).toBe('<li>A</li><li>B</li>')
  })

  test('inline partial with parent context', () => {
    const result = render('{{#def "item"}}{{../prefix}}: {{name}},{{/def}}{{#each items}}{{> item}}{{/each}}', {
      prefix: 'User',
      items: [{ name: 'A' }, { name: 'B' }],
    })
    expect(result).toBe('User: A,User: B,')
  })

  test('inline partial does not render in place', () => {
    const result = render('before{{#def "x"}}content{{/def}}after', {})
    expect(result).toBe('beforeafter')
  })

  test('partial without def throws', () => {
    expect(() => render('{{> missing}}', {})).toThrow()
  })

  test('variable expression: function call {{name.toUpperCase()}}', () => {
    const result = render('{{name.toUpperCase()}}', { name: 'hello' })
    expect(result).toBe('HELLO')
  })

  test('variable expression: arithmetic {{count + 1}}', () => {
    const result = render('{{count + 1}}', { count: 5 })
    expect(result).toBe('6')
  })

  test('variable expression: ternary {{age >= 18 ? "adult" : "minor"}}', () => {
    expect(render('{{age >= 18 ? "adult" : "minor"}}', { age: 20 })).toBe('adult')
    expect(render('{{age >= 18 ? "adult" : "minor"}}', { age: 15 })).toBe('minor')
  })

  test('expression: nullish coalescing returns right when left is null', () => {
    expect(render('{{name ?? "default"}}', { name: null })).toBe('default')
  })

  test('expression: nullish coalescing returns left when not null', () => {
    expect(render('{{name ?? "default"}}', { name: 'Alice' })).toBe('Alice')
  })

  test('expression: nullish coalescing returns right when left is missing', () => {
    expect(render('{{missing ?? "N/A"}}', {})).toBe('N/A')
  })

  test('expression: nullish coalescing returns right when left is undefined', () => {
    expect(render('{{x ?? "fallback"}}', { x: undefined })).toBe('fallback')
  })

  test('expression: nullish coalescing returns falsy but defined value (0)', () => {
    expect(render('{{score ?? 10}}', { score: 0 })).toBe('0')
  })

  test('expression: nullish coalescing returns falsy but defined value (empty string)', () => {
    expect(render('{{name ?? "anon"}}', { name: '' })).toBe('')
  })

  test('expression: nullish coalescing in conditional', () => {
    expect(render('{{#if (count ?? 5) > 3}}yes{{/if}}', {})).toBe('yes')
  })

  test('expression: array literal', () => {
    const result = render('{{[1, 2, 3]}}', {})
    expect(result).toBe('1,2,3')
  })

  test('expression: array literal with variable references', () => {
    const result = render('{{[a, b, c]}}', { a: 10, b: 20, c: 30 })
    expect(result).toBe('10,20,30')
  })

  test('expression: empty array', () => {
    const result = render('{{[]}}', {})
    expect(result).toBe('')
  })

  test('expression: array literal in each', () => {
    const result = render('{{#each [10, 20, 30]}}{{this}},{{/each}}', {})
    expect(result).toBe('10,20,30,')
  })

  test('expression: object literal parses without error', () => {
    expect(() => render('{{ {name: "Alice"} }}', {})).not.toThrow()
  })

  test('pipe filter: single filter', () => {
    const result = render('{{name | uppercase}}', { name: 'hello' }, {
      helpers: { uppercase(this: unknown) { return String(this).toUpperCase() } },
    })
    expect(result).toBe('HELLO')
  })

  test('pipe filter: chained filters', () => {
    const result = render('{{name | trim | uppercase}}', { name: ' hello ' }, {
      helpers: {
        trim(this: unknown) { return String(this).trim() },
        uppercase(this: unknown) { return String(this).toUpperCase() },
      },
    })
    expect(result).toBe('HELLO')
  })

  test('pipe filter: filter with arguments', () => {
    const result = render('{{name | truncate:5}}', { name: 'hello world' }, {
      helpers: {
        truncate(this: unknown, len: number) { return String(this).slice(0, len) },
      } as Record<string, (this: unknown, ...args: unknown[]) => unknown>,
    })
    expect(result).toBe('hello')
  })

  test('pipe filter: filter with multiple args', () => {
    const result = render('{{text | pad:4,"x"}}', { text: 'hi' }, {
      helpers: {
        pad(this: unknown, len: number, char: string) { return String(this).padEnd(len, char) },
      } as Record<string, (this: unknown, ...args: unknown[]) => unknown>,
    })
    expect(result).toBe('hixx')
  })

  test('pipe filter: missing filter returns value unchanged', () => {
    const result = render('{{name | missing_filter}}', { name: 'value' })
    expect(result).toBe('value')
  })

  test('pipe filter with expression value', () => {
    const result = render('{{name.toUpperCase() | lower}}', { name: 'Hello' }, {
      helpers: {
        lower(this: unknown) { return String(this).toLowerCase() },
      },
    })
    expect(result).toBe('hello')
  })

  test('pipe filter: filter name matches registered helper', () => {
    let count = 0
    const result = render('{{name | shout}}', { name: 'hey' }, {
      helpers: {
        shout(this: unknown) { count++; return String(this).toUpperCase() + '!' },
      },
    })
    expect(result).toBe('HEY!')
    expect(count).toBe(1)
  })

  test('compileToFunction attaches source map', () => {
    const { compileToFunction } = require('../src/index.js')
    const ast = compile('{{name}}')
    const fn = compileToFunction(ast)
    const map = (fn as unknown as Record<string, unknown>).__sourceMap as { generatedLine: number; sourceLine: number; sourceColumn: number }[]
    expect(Array.isArray(map)).toBe(true)
    expect(map.length).toBeGreaterThan(0)
    expect(map[0]!).toHaveProperty('generatedLine')
    expect(map[0]!).toHaveProperty('sourceLine')
    expect(map[0]!).toHaveProperty('sourceColumn')
  })

  test('variable expression: nested function call on object', () => {
    const result = render('{{user.name.toUpperCase()}}', { user: { name: 'alice' } })
    expect(result).toBe('ALICE')
  })

  test('variable expression: multiple arithmetic', () => {
    const result = render('{{a + b * c}}', { a: 1, b: 2, c: 3 })
    expect(result).toBe('7')  // 1 + (2*3) = 7
  })

  test('variable expression: subtraction and division', () => {
    const result = render('{{a - b / c}}', { a: 10, b: 6, c: 3 })
    expect(result).toBe('8')  // 10 - (6/3) = 8
  })

  test('variable expression: unary minus', () => {
    const result = render('{{-a}}', { a: 5 })
    expect(result).toBe('-5')
  })

  test('variable expression: function method chaining', () => {
    const result = render('{{greeting.toUpperCase()}}', { greeting: ' hello ' })
    expect(result).toBe(' HELLO ')
  })

  test('plugin: helpers are merged', () => {
    const result = render('{{greet}}', { name: 'World' }, {
      helpers: { greet(this: unknown) { return `Hi ${(this as Record<string, unknown>).name}` } },
      plugins: [{
        name: 'test',
        helpers: { greet() { return 'overridden' } },
      }],
    })
    // plugin helpers override user helpers
    expect(result).toBe('overridden')
  })

  test('plugin: afterRender transforms output', () => {
    const result = render('Hello {{name}}', { name: 'World' }, {
      plugins: [{
        name: 'upper',
        afterRender(output: string) { return output.toUpperCase() },
      }],
    })
    expect(result).toBe('HELLO WORLD')
  })

  test('plugin: beforeRender can modify template and data', () => {
    const result = render('{{greeting}} {{name}}', { name: 'World' }, {
      plugins: [{
        name: 'inject',
        beforeRender(tpl: string, data: Record<string, unknown>) {
          return { template: tpl.replace('{{greeting}}', 'Hi'), data: { ...data, name: String(data.name).toUpperCase() } }
        },
      }],
    })
    expect(result).toBe('Hi WORLD')
  })

  test('plugin: multiple plugins run in order', () => {
    const calls: string[] = []
    render('x', {}, {
      plugins: [
        { name: 'a', afterRender(o: string) { calls.push('a'); return o } },
        { name: 'b', afterRender(o: string) { calls.push('b'); return o } },
      ],
    })
    expect(calls).toEqual(['a', 'b'])
  })

  test('renderStream returns ReadableStream with rendered content', async () => {
    const stream = renderStream('Hello {{name}}!', { name: 'World' })
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let result = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      result += decoder.decode(value)
    }
    expect(result).toBe('Hello World!')
  })

  test('renderStream handles each loops', async () => {
    const stream = renderStream('{{#each items}}{{this}},{{/each}}', { items: ['a', 'b', 'c'] })
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let result = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      result += decoder.decode(value)
    }
    expect(result).toBe('a,b,c,')
  })

  test('renderStream can be used with Response for SSR', async () => {
    const stream = renderStream('<h1>{{title}}</h1>', { title: 'Hello' })
    const response = new Response(stream, { headers: { 'Content-Type': 'text/html' } })
    const text = await response.text()
    expect(text).toBe('<h1>Hello</h1>')
  })

  test('security: prototype pollution blocked (__proto__)', () => {
    const result = render('{{name}}', { name: 'safe', __proto__: { isAdmin: true } })
    expect(result).not.toContain('isAdmin')
  })

  test('security: dangerous keys throw (constructor)', () => {
    expect(() => render('{{constructor}}', {})).toThrow()
  })

  test('security: dangerous keys throw (prototype)', () => {
    expect(() => render('{{prototype}}', {})).toThrow()
  })

  test('clearCache + purgeTemplate purges compiled templates', () => {
    const { clearCache, purgeTemplate } = require('../src/index.js')
    const tpl = '{{name}}'
    render(tpl, { name: 'A' })
    const hit = purgeTemplate(tpl)
    expect(hit).toBe(true)
    const miss = purgeTemplate('never-cached')
    expect(miss).toBe(false)
    clearCache()
  })

  test('BoundedCache TTL evicts expired entries', () => {
    const { BoundedCache } = require('../src/index.js')
    const cache = new BoundedCache(10, 50)
    cache.set('k1', 'v1')
    expect(cache.get('k1')).toBe('v1')
    Bun.sleepSync(60)
    expect(cache.get('k1')).toBeUndefined()
  })

  test('BoundedCache per-entry TTL override', () => {
    const { BoundedCache } = require('../src/index.js')
    const cache = new BoundedCache(10, 1000)
    cache.set('live', 'l', 10000)
    cache.set('short', 's', 10)
    Bun.sleepSync(20)
    expect(cache.get('short')).toBeUndefined()
    expect(cache.get('live')).toBe('l')
  })

  test('BoundedCache memory estimation via stats', () => {
    const { BoundedCache } = require('../src/index.js')
    const cache = new BoundedCache(5)
    cache.set('a', 'hello world')
    cache.set('b', { x: 1, y: 2 })
    const stats = cache.stats
    expect(stats.size).toBe(2)
    expect(stats.capacity).toBe(5)
    expect(stats.memoryBytes).toBeGreaterThan(0)
    expect(typeof stats.memoryMB).toBe('string')
    expect(Number(stats.memoryMB)).toBeGreaterThanOrEqual(0)
  })

  test('BoundedCache hit/miss/eviction stats', () => {
    const { BoundedCache } = require('../src/index.js')
    const cache = new BoundedCache(2)
    cache.get('never')
    cache.set('a', 1)
    cache.get('a')
    cache.set('b', 2)
    cache.set('c', 3)
    const stats = cache.stats
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(1)
    expect(stats.evictions).toBe(1)
    expect(stats.size).toBe(2)
  })

  test('BoundedCache purge removes only expired', () => {
    const { BoundedCache } = require('../src/index.js')
    const cache = new BoundedCache(10)
    cache.set('fresh', 'f')
    cache.set('stale', 's', 1)
    Bun.sleepSync(10)
    const purged = cache.purge()
    expect(purged).toBe(1)
    expect(cache.get('fresh')).toBe('f')
    expect(cache.get('stale')).toBeUndefined()
  })

  test('getCacheStats exposes template and compiled cache info', () => {
    const { render, getCacheStats, clearCache } = require('../src/index.js')
    clearCache()
    render('{{x}}', { x: 1 })
    const stats = getCacheStats()
    expect(stats.template.size).toBeGreaterThanOrEqual(1)
    expect(stats.compiled.size).toBeGreaterThanOrEqual(1)
    expect(stats.compiled.hits).toBe(0)
    render('{{x}}', { x: 2 })
    const stats2 = getCacheStats()
    expect(stats2.compiled.hits).toBeGreaterThanOrEqual(1)
    clearCache()
  })

  test('precompile: compileToString generates valid JS', () => {
    const { compile, compileToString } = require('../src/index.js')
    const ast = compile('Hello {{name}}!')
    const code = compileToString(ast)
    expect(typeof code).toBe('string')
    expect(code).toContain('__d')
    expect(code).toContain('return $')
  })

  test('precompile: compileToFile writes valid JS module', () => {
    const { compile, compileToFile } = require('../src/index.js')
    const { mkdtempSync } = require('node:fs')
    const { join } = require('node:path')
    const ast = compile('<h1>{{title}}</h1>')
    const tmp = mkdtempSync('bun-html-test-')
    const outFile = join(tmp, 'page.html.js')
    compileToFile(ast, outFile)
    const content = require('node:fs').readFileSync(outFile, 'utf-8')
    expect(content).toContain('export default function')
    expect(content).toContain('__d')
    require('node:fs').rmSync(tmp, { recursive: true, force: true })
  })

  test('precompile: compileToFile output is importable and renderable', async () => {
    const { compile, compileToFile } = require('../src/index.js')
    const { mkdtempSync } = require('node:fs')
    const { join } = require('node:path')
    const { pathToFileURL } = require('node:url')
    const ast = compile('{{greeting}}, {{name}}!')
    const tmp = mkdtempSync('bun-html-test-')
    const outFile = join(tmp, 'greet.js')
    compileToFile(ast, outFile)

    const mod = await import(pathToFileURL(outFile).href)
    const output = mod.default({ greeting: 'Hi', name: 'Bun' }, {}, (s: string) => s)
    expect(output).toBe('Hi, Bun!')

    require('node:fs').rmSync(tmp, { recursive: true, force: true })
  })

  test('precompile: precompile() scans dir and generates barrel', () => {
    const { precompile } = require('../src/index.js')
    const { mkdtempSync } = require('node:fs')
    const { join } = require('node:path')
    const tmp = mkdtempSync('bun-html-test-')
    const viewsDir = join(tmp, 'views')

    const viewsSub = join(viewsDir, 'partial')
    require('node:fs').mkdirSync(viewsSub, { recursive: true })
    require('node:fs').writeFileSync(join(viewsDir, 'home.html'), '<h1>{{name}}</h1>')
    require('node:fs').writeFileSync(join(viewsSub, 'card.html'), '<span>{{text}}</span>')

    const outDir = join(tmp, 'out')
    const result = precompile(viewsDir, outDir)
    expect(result.files).toBe(2)
    expect(result.output).toBe(outDir)

    const barrelContent = require('node:fs').readFileSync(join(outDir, 'index.js'), 'utf-8')
    expect(barrelContent).toContain('import home_html')
    expect(barrelContent).toContain('import partial_card_html')

    require('node:fs').rmSync(tmp, { recursive: true, force: true })
  })

  test('fuzz: deeply nested #if does not crash (50 levels)', () => {
    let tpl = '{{name}}'
    for (let i = 0; i < 50; i++) {
      tpl = `{{#if name}}${tpl}{{/if}}`
    }
    expect(() => render(tpl, { name: 'test' })).not.toThrow()
  })

  test('fuzz: deeply nested #each does not crash', () => {
    let tpl = '{{this}}'
    for (let i = 0; i < 20; i++) {
      tpl = `{{#each items}}${tpl}{{/each}}`
    }
    const data: any = { items: [{ items: [{ items: [] }] }] }
    expect(() => render(tpl, data)).not.toThrow()
  })

  test('fuzz: deeply nested #with does not crash', () => {
    let tpl = '{{name}}'
    for (let i = 0; i < 20; i++) {
      tpl = `{{#with obj}}${tpl}{{/with}}`
    }
    const data: any = { obj: { obj: { obj: { obj: { obj: { name: 'x' } } } } } }
    expect(() => render(tpl, data)).not.toThrow()
  })

  test('fuzz: unclosed #each throws with position', () => {
    expect(() => render('{{#each items}}oops', { items: [] })).toThrow('Unclosed {{#each}}')
  })

  test('fuzz: unclosed #if throws with position', () => {
    expect(() => render('{{#if x}}oops', { x: true })).toThrow('Unclosed {{#if}}')
  })

  test('fuzz: malformed expression resolves gracefully as variable name', () => {
    expect(() => render('{{name.}}', { name: 'test' })).not.toThrow()
    expect(render('{{name.}}', { name: 'test' })).toBe('')
  })

  test('fuzz: unterminated string falls back to property lookup', () => {
    expect(() => render('{{ x == "unclosed }}', {})).not.toThrow()
  })

  test('fuzz: large template (10K chars) does not crash', () => {
    const line = '<li>item</li>\n'
    const tpl = `<ul>${line.repeat(300)}</ul>`  // ~9.8K
    const result = render(tpl, {})
    expect(result).toContain('<ul>')
    expect(result).toContain('</ul>')
  })

  test('fuzz: template max length enforced via render()', () => {
    const huge = 'x'.repeat(1_000_001)
    expect(() => render(huge, {})).toThrow('Template exceeds maximum length')
  })

  test('fuzz: unicode and emoji handled correctly', () => {
    expect(render('{{smile}} world', { smile: '😀' })).toBe('😀 world')
    const result = render('{{#each items}}{{this}},{{/each}}', {
      items: ['café', 'naïve', '東京'],
    })
    expect(result).toBe('café,naïve,東京,')
  })

  test('fuzz: script tag auto-escaped', () => {
    const result = render('<div>{{content}}</div>', { content: '<script>alert(1)</script>' })
    expect(result).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(result).not.toContain('<script>')
  })

  test('fuzz: HTML entities preserved', () => {
    const result = render('{{text}}', { text: '&amp; &lt; &gt;' })
    expect(result).toBe('&amp;amp; &amp;lt; &amp;gt;')
  })

  test('fuzz: inline partial recursive depth caught', () => {
    expect(() => {
      render('{{#def "loop"}}{{#if true}}{{> loop}}{{/if}}{{/def}}{{> loop}}', {})
    }).toThrow('Partial recursion too deep')
  })

  test('fuzz: empty template renders nothing', () => {
    expect(render('', {})).toBe('')
    expect(render('   ', {})).toBe('   ')
  })

  test('fuzz: null/undefined data does not crash', () => {
    expect(() => render('{{name}}', null as any)).not.toThrow()
    expect(() => render('{{name}}', undefined as any)).not.toThrow()
  })

  test('fuzz: prototype pollution blocked via validateKey', () => {
    expect(() => render('{{__proto__}}', {})).toThrow('not allowed')
    expect(() => render('{{constructor}}', {})).toThrow('not allowed')
    expect(() => render('{{#each constructor}}x{{/each}}', {})).toThrow('not allowed')
  })

  test('fuzz: whitespace control strips adjacent whitespace', () => {
    expect(render('{{~name~}}', { name: 'x' })).toBe('x')
    expect(render('a{{~name~}}b', { name: 'x' })).toBe('axb')
    expect(render('a {{~name~}} b', { name: 'x' })).toBe('axb')
  })

  test('fuzz: cache TTL eviction works under load', () => {
    const { BoundedCache } = require('../src/index.js')
    const cache = new BoundedCache(3, 10)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    cache.set('d', 4)
    expect(cache.size).toBeLessThanOrEqual(3)
    Bun.sleepSync(20)
    cache.purge()
    expect(cache.size).toBe(0)
  })

})
