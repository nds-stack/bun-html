# Changelog

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
