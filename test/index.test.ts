import { describe, test, expect } from 'bun:test'
import { render, compile } from '../src/index.js'

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

})
