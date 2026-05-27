export { render, renderStream, compile, clearCache, purgeTemplate, getCacheStats } from './renderer.js'
export { compileToFunction, compileToString, compileToFile, type SourceMapEntry } from './compiler.js'
export { clearPartials } from './runtime.js'
export { precompile, type PrecompileResult } from './precompile.js'
export * as adapter from './adapters/index.js'
export type { Token, ASTNode, RenderOptions, CompiledTemplate, ExprNode, Plugin, PipeFilter } from './types.js'
export type {
  ASTNodeText,
  ASTNodeVariable,
  ASTNodeRawVariable,
  ASTNodeEach,
  ASTNodeIf,
  ASTNodeUnless,
  ASTNodeWith,
  ASTNodePartialDef,
  ASTNodePartial,
  ASTNodeLayout,
} from './types.js'
export type { CacheStats } from './cache.js'
export { BoundedCache } from './cache.js'
