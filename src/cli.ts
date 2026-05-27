import { precompile } from './precompile.js'

const args = process.argv.slice(2)

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`@nds-stack/bun-html — Bun-native HTML template engine`)
  console.log(`Usage: bun-html <command> [options]`)
  console.log(``)
  console.log(`Commands:`)
  console.log(`  compile <inputDir> [--out <outputDir>]  Precompile all .html files to JS modules`)
  console.log(`  --help, -h                               Show this help`)
  process.exit(0)
}

const command = args[0]

switch (command) {
  case 'compile': {
    const inputDir = args[1]
    if (!inputDir) {
      console.error('Error: input directory is required')
      console.error('Usage: bun-html compile <inputDir> [--out <outputDir>]')
      process.exit(1)
    }

    const outFlagIdx = args.indexOf('--out')
    const outputDir = outFlagIdx !== -1 ? args[outFlagIdx + 1] : 'dist/views'
    if (!outputDir) {
      console.error('Error: --out requires a value')
      process.exit(1)
    }

    const result = precompile(inputDir, outputDir)
    console.log(`Precompiled ${result.files} template(s) → ${result.output}`)
    break
  }

  default:
    console.error(`Unknown command: ${command}`)
    console.error('Use --help for usage information')
    process.exit(1)
}
