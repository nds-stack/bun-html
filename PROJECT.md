# PROJECT.md — bun-html

## Visi

HTML template engine yang ringan, cepat, dan aman untuk Bun — tanpa dependencies eksternal.

## Filosofi

1. **Zero dependencies** — Gunakan built-in Bun APIs saja
2. **Mustache-compatible syntax** — Familiar, sederhana, mudah dipelajari
3. **Auto-escape by default** — Keamanan XSS tanpa effort
4. **Async partials** — Manfaatkan Bun.file() untuk file I/O efisien
5. **Simple > feature-rich** — Fitur yang cukup, bukan sebanyak mungkin

## Arsitektur

```
Template string → Lexer → Token[] → Parser → AST[] → Renderer → Output string
```

- **Lexer**: Regex-based tokenizer, O(n)
- **Parser**: Recursive descent, O(n)
- **Renderer**: Tree walker with context stack, O(n)
- **Caching**: Template + partial cache via Map (O(1) lookup)

## Target

- SSR untuk Bun web framework (Bun.serve, Elysia, Hono)
- Static site generation
- Email template rendering
- Any HTML templating in Bun environment
