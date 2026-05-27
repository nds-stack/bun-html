# TODO.md — bun-html

## v0.1.0-alpha.0 ✅

- [x] Lexer implementation
- [x] Parser implementation
- [x] Renderer implementation
- [x] Auto-escape via Bun.escapeHTML()
- [x] Raw interpolation `{{{var}}}`
- [x] `{{#each}}` loops with @index, @key
- [x] `{{#if}}`/`{{else}}` conditionals
- [x] `{{#unless}}` conditionals
- [x] Async partials via Bun.file()
- [x] Layout wrapper
- [x] Dot notation variable resolution
- [x] Custom helpers
- [x] Template caching
- [x] 25+ tests
- [x] Benchmark suite
- [x] README with 9 sections

## v0.2.0 (Next)

- [ ] Whitespace control (`{{- -}}`)
- [ ] Parent context access (`{{../var}}`)
- [ ] Inline partials
- [ ] `{{#with}}` context block
- [ ] Comment tags (`{{! comment }}`)

## v0.3.0 (Future)

- [ ] Plugin system
- [ ] Precompilation
- [ ] Stream rendering
- [ ] Source maps
