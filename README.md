# @nds-stack/bun-html

Zero-dependency Bun-native HTML template engine with mustache-like syntax, auto-escape via `Bun.escapeHTML()`, async partials via `Bun.file()`, and custom helpers.

```ts
import { render } from '@nds-stack/bun-html'

const html = render('<h1>Hello {{name}}!</h1>', { name: 'World' })
// → '<h1>Hello World!</h1>'
```

## How It Works

1. **Lexer** — Tokenizes the template string into structured tokens (Text, Variable, Each, If, Unless, Partial, Layout)
2. **Parser** — Recursive descent parser builds an AST from the token stream
3. **Renderer** — Walks the AST, resolves variables from the data context, produces output

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

### Template Tags

| Tag | Description |
|-----|-------------|
| `{{var}}` | Auto-escaped interpolation |
| `{{{var}}}` | Raw (unescaped) interpolation |
| `{{#each items}}...{{/each}}` | Loop — context: `{{this}}`, `{{@index}}`, `{{@key}}` |
| `{{#if cond}}...{{else}}...{{/if}}` | Conditional |
| `{{#unless cond}}...{{/unless}}` | Inverse conditional |
| `{{> partialName}}` | Partial (async, loaded via `Bun.file()`) |
| `{{#layout "name"}}...{{/layout}}` | Layout wrapper (content available as `{{content}}`) |

Variables support dot notation: `{{user.name}}`, `{{address.city.zip}}`.

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

- No whitespace trimming (all whitespace in templates is preserved)
- No expression evaluation (variables only — no `{{#if user.age > 18}}`)
- No parent context access (`{{../var}}`) in nested blocks
- Partials and layouts always require `partialsDir` and are async-only
- Helper arguments are not parsed from template expressions (helpers receive `this` context only)

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

## Comparison Table

| Feature | bun-html | mustache | handlebars | ejs |
|---------|----------|----------|------------|-----|
| Zero dependencies | ✅ | ❌ | ❌ | ❌ |
| Bun-native (Bun.escapeHTML, Bun.file) | ✅ | ❌ | ❌ | ❌ |
| Async partials | ✅ | ❌ | ❌ | ❌ |
| Layouts | ✅ | ❌ | ❌ | ❌ |
| Auto-escape | ✅ default | ✅ default | ✅ default | ❌ |
| Raw output (`{{{}}}`) | ✅ | ✅ | ✅ | N/A |
| Loops | ✅ | ✅ | ✅ | ✅ |
| Conditionals | ✅ | ❌ | ✅ | ✅ |
| Helpers | ✅ | ❌ | ✅ | ✅ |
| Template caching | ✅ | ❌ | ✅ | ✅ |
| Whitespace control | ❌ | ❌ | ✅ | ✅ |
| Expressions | ❌ | ❌ | ❌ | ✅ |

## Benchmarks

```
$ bun run bench

cpu: ...
runtime: bun ...

benchmark                                    iterations  avg (ns)
@nds-stack/bun-html (no cache)           ...        ...       ...
@nds-stack/bun-html (cached)             ...        ...       ...
ejs                                        ...        ...       ...
handlebars                                 ...        ...       ...
mustache                                   ...        ...       ...
```

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
    {{#if admin}}
      <strong>ADMIN</strong>
    {{else}}
      <em>user</em>
    {{/if}}
  </li>
{{/each}}
</ul>
`

const html = render(template, { users })
// Works with Bun.serve() for SSR
```
