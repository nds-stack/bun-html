#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const cliPath = join(__dirname, '..', 'dist', 'cli.js')
const result = spawnSync('bun', [cliPath, ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(result.status ?? 1)
