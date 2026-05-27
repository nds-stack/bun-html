# Changelog

## [0.1.0-alpha.5] — 2026-05-27

### Fixed
- Async path (partialsDir): parent context `../var` now correctly pushes parent scope instead of current item in `Each` and `With` blocks
- `evaluateExpr` now allows property access on primitive values (string, number) — fixes `{{name.toUpperCase()}}` in async path
- `purgeTemplate` now returns `true` if either template or compiled cache was purged
- Removed dead code branch in `genExpr` CallExpression
- String tokenizer handles escape sequences (`\"`, `\\`)
- `validatePartialName` rejects empty names
- Single quote in partial name no longer breaks generated error message
- `callee(...args)` now used instead of `callee.apply(null, args)` for consistency with compiled path
- README limitation updated: compiled path supports full expressions; async path limited to conditionals

## [0.1.0-alpha.4] — 2026-05-27

### Added
- Variable interpolation expressions — function calls (`{{name.toUpperCase()}}`), arithmetic (`{{count + 1}}`), ternary (`{{age >= 18 ? "adult" : "minor"}}`)
- Full operator precedence: `!`, `-` (unary), `*`, `/`, `+`, `-`, comparison, `&&`, `||`, ternary
- Expression support in `{{var}}` and `{{{var}}}` (previously only in `{{#if}}`)

### Fixed
- async parent context stack, evaluateExpr primitive access, purgeTemplate return, readme limitation (moved to alpha.5)

## [0.1.0-alpha.3] — 2026-05-27

### Added
- Inline partials: `{{#def "name"}}...{{/def}}` + `{{> name}}`
- Inline partials take priority over file-based partials when `partialsDir` is set
- `{{> name}}` without a matching `{{#def}}` or `partialsDir` now throws a clear error

## [0.1.0-alpha.2] — 2026-05-27

### Added
- Parent context access (`{{../var}}`) — supports multiple levels (`{{../../var}}`)
- `{{../var}}` works in `{{#if}}` expressions with comparisons

### Changed
- Context tracking now uses `__s` stack for proper multilevel parent resolution

### Fixed
- Number tokenizer no longer greedily consumes `+`/`-` operators (`1+2` now parses correctly)
- `../@index` and `../@key` now throw clear error instead of returning wrong value
- Hono adapter `any` type replaced with typed `MinimalContext` interface
- Layout name validation rejects malformed syntax (`{{#layout "name" extra}}`)
- Hono adapter `dir` option now correctly mapped to `partialsDir`
- `evaluateExpr()` (async path) now supports `../` parent context in expressions

## [0.1.0-alpha.1] — 2026-05-27

### Added
- Whitespace control: `{{~tag~}}` strip adjacent whitespace
- Expressions in conditionals: `>`, `<`, `>=`, `<=`, `==`, `!=`, `&&`, `||`, `!`, `()`, string/number/boolean/null literals
- `{{! comment }}` — comments stripped from output
- `{{#with key}}` — scoped context block
- Template compiler: `compileToFunction()` generates JS function via `new Function()` for 3–10× faster rendering
- `adapter.express({ dir })` — Express view engine adapter
- `adapter.hono({ dir })` — Hono middleware adapter

### Changed
- `render()` now uses compiled JS functions by default (cache: true)
- `BoundedCache.set()` no longer evicts on existing key update

### Fixed
- Path traversal guard on partial/layout names
- `resolveValue` now allows array property access (sync with expression evaluator)
- Short-circuit evaluation for `&&` and `||` in expressions
- `.npmignore` excludes CHANGELOG.md from npm publish

## [0.1.0-alpha.0] — 2026-05-27

### Added
- Initial release
- Lexer: tokenize templates into structured tokens
- Parser: recursive descent AST builder
- Renderer: AST walker with variable resolution
- `{{var}}` auto-escaped interpolation via `Bun.escapeHTML()`
- `{{{var}}}` raw (unescaped) interpolation
- `{{#each}}` loop with `{{this}}`, `{{@index}}`, `{{@key}}`
- `{{#if}}`/`{{else}}` conditional blocks
- `{{#unless}}` inverse conditional blocks
- `{{> partialName}}` async partials via `Bun.file()`
- `{{#layout "name"}}` layout wrapper
- Dot notation variable resolution (`{{user.name}}`)
- Custom helper functions
- Template caching (`Map<string, ASTNode[]>`)
- Partial caching (`Map<string, ASTNode[]>`)
- Zero dependencies — Bun built-in APIs only
