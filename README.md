# @nds-stack/bun-html

[![npm version](https://img.shields.io/npm/v/%40nds-stack%2Fbun-html?color=blue&logo=npm)](https://www.npmjs.com/package/@nds-stack/bun-html) [![Bun](https://img.shields.io/badge/Bun-%3E%3D1.3.0-black?logo=bun)](https://bun.sh) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org) [![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Zero-dependency Bun-native HTML template engine with mustache-like syntax, auto-escape via `Bun.escapeHTML()`, async partials via `Bun.file()`, and custom helpers.

```ts
import { render } from '@nds-stack/bun-html'

const html = render('<h1>Hello {{name}}!</h1>', { name: 'World' })
// → '<h1>Hello World!</h1>'
```

## How It Works

1. **Lexer** — Tokenizes the template string into structured tokens (Text, Variable, Each, If, Unless, With, Partial, Layout)
2. **Parser** — Recursive descent parser builds an AST from the token stream
3. **Compiler** — Generates a JS function via `new Function()` for raw speed
4. **Renderer** — Executes the compiled function with the data context

Auto-escaping uses `Bun.escapeHTML()` internally. Async partials read template files via `Bun.file()` with built-in caching.

## API

### `render(template, data, options?)`

| Param | Type | Description |
|-------|------|-------------|
| `template` | `string` | Template string with `{{}}` tags |
| `data` | `Record<string, unknown>` | Context data object |
| `options` | `RenderOptions` | Optional configuration |

**Returns:** `string` (sync) or `Promise<string>` (when `partialsDir` is set)

### `compile(template, options?)`

Compiles a template string into an AST array. Results are cached unless `cache: false` is set.

### `compileToFunction(template)`

Compiles a template directly into a reusable JS function:

```ts
import { compileToFunction } from '@nds-stack/bun-html'

const fn = compileToFunction('Hello {{name}}!')
fn({ name: 'World' }, undefined, Bun.escapeHTML)
// → 'Hello World!'
```

### `clearCache()` / `purgeTemplate(template)`

```ts
import { clearCache, purgeTemplate } from '@nds-stack/bun-html'

purgeTemplate('Hello {{name}}')  // Remove single template from cache
clearCache()                      // Clear all caches (templates + partials + compiled)
```

### `adapter`

```ts
import { adapter } from '@nds-stack/bun-html'

// Express — returns (filePath, data, callback) for app.engine()
adapter.express({ dir: './views' })

// Hono — returns middleware that adds c.var.render()
adapter.hono({ dir: './views' })
```

See [Framework Adapters](#framework-adapters) for full usage.

### Template Tags

| Tag | Description |
|-----|-------------|
| `{{var}}` | Auto-escaped interpolation |
| `{{{var}}}` | Raw (unescaped) interpolation |
| `{{#each items}}...{{/each}}` | Loop — context: `{{this}}`, `{{@index}}`, `{{@key}}` |
| `{{#if cond}}...{{else}}...{{/if}}` | Conditional — supports expressions: `{{#if age > 18}}` |
| `{{#unless cond}}...{{/unless}}` | Inverse conditional — supports expressions |
| `{{#with key}}...{{/with}}` | Scoped context — changes `__d` to `key` within the block |
| `{{! comment }}` | Comment — stripped entirely from output |
| `{{> partialName}}` | Partial (async, loaded via `Bun.file()`) |
| `{{#layout "name"}}...{{/layout}}` | Layout wrapper (content available as `{{content}}`) |

Variables support dot notation: `{{user.name}}`, `{{address.city.zip}}`.

**Loop context:** Inside `{{#each}}`, the following variables are available:
| Variable | Description |
|----------|-------------|
| `{{this}}` | The current item |
| `{{@index}}` | Current index (0-based) |
| `{{@key}}` | Current key (index for arrays, property name for objects) |

**Parent context access:** Inside nested blocks, use `../` to access the parent scope. Multiple levels are supported:
```handlebars
{{#each groups}}
  {{#each items}}
    {{../../title}} - {{../name}}: {{this}}
  {{/each}}
{{/each}}
```
One `../` per nesting level. Inside `{{#each groups}}` → `{{../title}}`. Inside nested `{{#each items}}` → `{{../../title}}`.

**Expressions in conditionals:** `{{#if}}` and `{{#unless}}` support full expressions:
| Operator | Example |
|----------|---------|
| Comparison | `>`, `<`, `>=`, `<=`, `==`, `!=` |
| Logical | `&&`, `\|\|`, `!` |
| Parentheses | `(age > 18) && (role == "admin")` |
| Literals | Numbers (`18`), strings (`"admin"`), booleans (`true`/`false`), `null`, `undefined` |
| Property access | `user.age`, `items.length` |

**Whitespace control:** Add `~` inside mustache delimiters to strip adjacent whitespace:
| Syntax | Description |
|--------|-------------|
| `{{~tag}}` | Strip whitespace before the tag |
| `{{tag~}}` | Strip whitespace after the tag |
| `{{~tag~}}` | Strip both sides |
| `{{{~raw~}}}` | Same for raw `{{{}}}` tags |
| `{{~#if~}}`, `{{~/if~}}` | Strip around block open/close tags |

```ts
render('item = {{~val~}} end', { val: 'x' })
// → 'item = xend'     (whitespace around val stripped)

render('{{~#each items~}}\n  {{this}}\n{{~/each~}}', { items: ['a', 'b'] })
// → 'ab'               (newlines and indentation stripped)
```

### RenderOptions

```ts
interface RenderOptions {
  partialsDir?: string        // Directory for partial files (triggers async mode)
  cache?: boolean             // Cache compiled templates (default true)
  autoescape?: boolean        // Auto-escape {{var}} (default true)
  helpers?: Record<string, (this: unknown, ...args: unknown[]) => unknown>
}
```

## Error Handling

- Unclosed block tags (`{{#each}}`, `{{#if}}`, etc.) throw a `SyntaxError`
- Mismatched close tags (`{{/if}}` without open) throw a `SyntaxError`
- Missing variables render as empty string (no throw)
- `null`/`undefined` values render as empty string
- `{{> partial}}` without `partialsDir` set throws
- Partials that don't exist throw (from `Bun.file().text()`)

## Limitations

- No parent context access (`{{../var}}`) in nested blocks
- Partials and layouts always require `partialsDir` and are async-only
- Helper arguments are not parsed from template expressions (helpers receive `this` context only)
- Expression support limited to conditionals (`{{#if}}`, `{{#unless}}`) — variable interpolation uses simple path resolution
- `{{../var}}` in conditionals only supports simple parent access, not compound expressions (`../age > 18` works but not `../user.age > 18 && ../active`)
- Custom delimiters not supported (uses `{{}}` exclusively)
- No browser build (requires Bun/Node.js runtime)

## Multi-Instance / Cross-Boundary

Each call to `render()` is stateless. Caches (`templateCache`, `partialCache`) are module-level `Map` instances shared across all renders:

- **Same process:** Templates are cached once and reused across renders
- **Cross-instance:** No shared state — each process has its own cache
- **Worker threads:** Each worker has its own cache (module-level)
- **Cache invalidation:** Call `compile(template, { cache: false })` to bypass

## Customization Guide

### Disable caching
```ts
render(tpl, data, { cache: false })
```

### Disable auto-escape
```ts
render(tpl, data, { autoescape: false })
```

### Custom helpers
```ts
render('{{uppercase}}', { name: 'hello' }, {
  helpers: {
    uppercase(this: unknown) {
      return String(this).toUpperCase()
    },
  },
})
```

### Async with partials
```ts
await render('{{> header}}<main>{{content}}</main>{{> footer}}', data, {
  partialsDir: './partials',
})
```

### Layouts
```ts
await render('{{#layout "main"}}{{content}}{{/layout}}', data, {
  partialsDir: './layouts',
})
// layouts/main.html: <html><body>{{content}}</body></html>
```

### {{#with}}
```ts
render('{{#with user}}<h1>{{name}}</h1>{{/with}}', { user: { name: 'Alice' } })
// → '<h1>Alice</h1>'
```

### Comments
```ts
render('Hello{{! this is a comment }}World', {})
// → 'HelloWorld'
```

## Framework Adapters

### Express

```ts
import { adapter } from '@nds-stack/bun-html'

app.engine('html', adapter.express({ dir: './views' }))
app.set('view engine', 'html')

app.get('/', (req, res) => {
  res.render('index', { title: 'Hello' })
  // renders ./views/index.html
})
```

### Hono

```ts
import { Hono } from 'hono'
import { adapter } from '@nds-stack/bun-html'

const app = new Hono()

app.use('*', adapter.hono({ dir: './views' }))

app.get('/', (c) => {
  return c.html(c.var.render('<h1>{{title}}</h1>', { title: 'Hello' }))
})
```

## Comparison Table

| Feature | bun-html | mustache | handlebars | ejs |
|---------|----------|----------|------------|-----|
| Zero dependencies | ✅ | ❌ | ❌ | ❌ |
| Bun-native (Bun.escapeHTML, Bun.file) | ✅ | ❌ | ❌ | ❌ |
| Async partials | ✅ | ❌ | ❌ | ❌ |
| Layouts | ✅ | ❌ | ❌ | ❌ |
| Scoped context (`#with`) | ✅ | ✅ | ✅ | ✅ |
| Parent context (`../var`) | ✅ | ✅ | ✅ | ✅ |
| Comments | ✅ | ✅ | ❌ | ✅ |
| Auto-escape | ✅ default | ✅ default | ✅ default | ❌ |
| Raw output (`{{{}}}`) | ✅ | ✅ | ✅ | N/A |
| Loops | ✅ | ✅ | ✅ | ✅ |
| Conditionals | ✅ | ❌ | ✅ | ✅ |
| Helpers | ✅ | ❌ | ✅ | ✅ |
| Template caching | ✅ | ❌ | ✅ | ✅ |
| Whitespace control | ✅ | ❌ | ✅ | ✅ |
| Expressions | ✅ | ❌ | ❌ | ✅ |

## Benchmarks

> **Methodology:** Each library renders each template 5,000 iterations (100 warmup) using their **default rendering mode**. ejs and Handlebars pre-compile via `.compile()`. bun-html caches compiled JS functions (`new Function()`) by default. Mustache re-parses every call (no compilation). Results in ops/sec (higher is better).

| Template | @nds-stack/bun-html | ejs | handlebars | mustache |
|---|---|---|---|---|
| Variable | 1.7M | 560K | 208K | 717K |
| Loop (3 items) | 1.4M | 257K | 276K | 313K |
| Conditional + expression | 9.9M | 666K | 665K | 580K |
| Combined | 2.5M | 221K | 336K | 396K |

> **All libraries are on equal footing:** ejs and Handlebars also compile to JS functions — bun-html is just faster at it thanks to Bun's optimized `new Function()` and native `Bun.escapeHTML()`.

Run `bun run bench` in your environment for current results.

## Real-World Example

```ts
import { render } from '@nds-stack/bun-html'

const users = [
  { name: 'Alice', role: 'admin' },
  { name: 'Bob', role: 'user' },
]

const template = `
<ul>
{{#each users}}
  <li>
    <span>{{name}}</span>
    {{#if role == "admin"}}
      <strong>ADMIN</strong>
    {{else}}
      <em>user</em>
    {{/if}}
  </li>
{{/each}}
</ul>
`

const html = render(template, { users })
// <ul><li><span>Alice</span><strong>ADMIN</strong></li><li><span>Bob</span><em>user</em></li></ul>
```
