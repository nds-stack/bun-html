#!/usr/bin/env node
const { spawnSync } = require('child_process')
const { join } = require('path')

const cli = join(__dirname, '..', 'dist', 'cli.js')
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(result.status ?? 1)
