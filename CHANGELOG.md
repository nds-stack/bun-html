# Changelog

## [0.1.0-alpha.11] — 2026-05-28

### Fixed
- CLI binary entry now includes shebang (`#!/usr/bin/env bun`) — `bun-html` command works after `npm install`

## [0.1.0-alpha.10] — 2026-05-28

### Added
- Precompile API: `compileToString(ast)` → JS source code, `compileToFile(ast, path)` → ESM module file
- `precompile(inputDir, outputDir)` — scans `.html` files, compiles to JS, generates barrel `index.js`
- Precompile CLI: `bun-html compile <inputDir> [--out <outputDir>]` with `--help` and `--version`
- Benchmark expanded to 5 engines: ejs, handlebars, mustache, nunjucks (+ eta installed)
- Benchmark metrics: memory usage (heapUsed delta), startup time (cold vs warm)
- Fuzz testing: 14 edge case tests (deep nesting 50 levels, unicode, script tags, prototype pollution, whitespace, cache TTL under load, null/undefined data, large templates)
- `getCacheStats()` — exposes template + compiled cache stats (hits, misses, evictions, memory)
- `clearPartials()` now exported to public API
- `BoundedCache` fully documented in README (TTL, purge, stats, per-entry TTL override)
- Pipe/filter syntax, nullish coalescing `??`, array/object literals documented in README
- Precompile CLI + barrel generation documented
- `--version` / `-v` flag on CLI
- `render()` now also enforces `MAX_TEMPLATE_LENGTH` (was only in `compile()`)

### Changed
- Plugin processing extracted to `processPlugins()` / `applyAfterRender()` shared helpers (30 duplicated lines eliminated)
- `renderStream` backpressure uses `Bun.sleep(0)` instead of `setTimeout`
- README: 491 lines (+88), 11 API functions documented, expression table now 8 rows, limitations updated

### Fixed
- Async path `CallExpression` now correctly binds `this` — `{{name.toUpperCase()}}` works in async mode (partialsDir, renderStream)
- Async path limitation removed from docs — both sync and async paths have full expression support
- `BoundedCache` constructor guards `max >= 1` (was unbounded negative possible)
- Redundant `compile` import removed from source map test
- CHANGELOG.md now excluded from `.gitignore` (was accidentally getting ignored)

### Tests
- 125 tests (+22 from alpha.9): 4 precompile + 14 fuzz + 4 edge fixes

## [0.1.0-alpha.9] — 2026-05-28

### Added
- Expression: nullish coalescing operator (`??`) — `{{name ?? "default"}}`
- Expression: array literals (`[1, 2, 3]`) and object literals (`{key: val}`)
- Pipe/filter syntax: `{{name | uppercase | truncate:10}}` with chaining and arguments
- Source maps for compiled templates (`__sourceMap` on `compileToFunction()` result)
- `BoundedCache` TTL support — constructor `(max, defaultTtl)`, per-entry `set(key, val, ttl)`
- `BoundedCache` memory estimation + stats: `hits`, `misses`, `evictions`, `memoryBytes`, `memoryMB`
- `BoundedCache.purge()` — removes all expired entries
- `getCacheStats()` — exposes template + compiled cache stats
- `clearPartials()` — now exported to public API

### Changed
- Shared evaluator core: all AST nodes (`Variable`, `RawVariable`, `Each`, `With`, `If`, `Unless`) now carry `exprAst` — both sync (compiled) and async (AST walker) paths use `evaluateExpr`
- Async path now correctly handles expressions (function calls, arithmetic, ternary, `??`, literals) — previously expressions were only available in compiled mode
- `render()` signature unchanged but internal path resolution deduplicated via shared `tryParseExpression`
- `BoundedCache` constructor now guards max ≥ 1 (was unbounded negative possible)

### Fixed
- Pipe filter `this` binding: compiled filters now receive the value as `this` (was incorrectly passing `__d` data object)
- `PipeFilter` interface properly exported from `types.ts`
- Redundant `compile` import removed from source map test
- CHANGELOG.md now excluded from `.gitignore` (was accidentally getting ignored)

### Security
- `validateKey` guard unchanged from alpha.8 — all `??`, `[]` , `{}` literals pass through the same expression evaluator with full prototype pollution protection

## [0.1.0-alpha.8] — 2026-05-27

### Added
- Security hardening: prototype pollution guard (`validateKey`) blocks `__proto__`, `constructor`, `prototype`, `eval`, `Function`, etc.
- Error diagnostics: line/column tracking in lexer + parser — all errors include `at line X, column Y`
- Recursive partial depth limit (max 50) to prevent infinite loops
- Refactored into 13 small files (<211 lines each) — `cache.ts`, `evaluator.ts`, `runtime.ts`
- Examples enriched to 15 varied use cases (expressions, plugins, streaming, adapters)
- Tests: 77 (4 new: security + cache management)

### Fixed
- Cache key whitespace sensitivity documented in README
- `UnaryMinus` on `undefined`/`null` now returns 0 instead of NaN
- Exhaustive switch `default: never` in evaluator for compile-time safety
- Empty parent path `../` no longer adds empty path segments
- Dead code `formatPosition` removed from `types.ts`
- String tokenizer now throws on unterminated string literals
- `validatePartialName` now rejects empty names
- `purgeTemplate` correctly returns result from both template and compiled caches

### Changed
- `renderer.ts` (364 lines) split into `cache.ts`, `runtime.ts`, `renderer.ts` (119 lines)
- `expression.ts` (364 lines) split — evaluator moved to `evaluator.ts` (93 lines)

## [0.1.0-alpha.7] — 2026-05-27

### Added
- Stream rendering: `renderStream()` returns `ReadableStream<Uint8Array>` for progressive HTML delivery
- Works with `new Response(renderStream(...), { headers })` for Bun/Hono SSR
- Uses AST walker (async path) — respects `partialsDir`, plugins, helpers

## [0.1.0-alpha.6] — 2026-05-27

### Added
- Plugin system: `beforeRender`, `afterRender` hooks and plugin helper merging
- `plugins` option in `RenderOptions`
- Plugin helpers override user helpers for same key
- Multiple plugins run in order (FIFO)

### Fixed
- Plugin helpers now correctly passed to async path (partialsDir mode)
- `.then()` chain replaced with `async/await` in render function

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
