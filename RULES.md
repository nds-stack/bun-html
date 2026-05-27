# RULES.md — bun-html

## Coding Standards

| Aspek | Standar |
|-------|---------|
| **Runtime** | Bun — no Node.js/Deno |
| **TypeScript** | Strict mode, no `any`, no `// @ts-ignore` |
| **Modules** | ESM only — `import`/`export`, `.js` extension |
| **Files** | Kebab-case (`lexer.ts`, `renderer.ts`) |
| **Types** | PascalCase (`ASTNode`, `RenderOptions`) |
| **Functions** | camelCase (`tokenize`, `renderNodeSync`) |
| **Comments** | No comments in source code |
| **Dependencies** | Zero — Bun built-in APIs only |

## Folder Structure

```
src/     — Source code (6 files max)
test/    — Test files (min 15 tests)
bench/   — Benchmark files
examples/ — Usage examples
docs/    — Documentation (future)
```

## Git Rules

- `dist/`, `node_modules/`, `*.tsbuildinfo` di .gitignore
- `*.md` di .npmignore (kecuali README.md, CHANGELOG.md)
- `context7.json` di .npmignore
