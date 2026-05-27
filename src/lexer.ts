import type { Token } from './types.js'

export function tokenize(template: string): Token[] {
  const tokens: Token[] = []
  let lastIndex = 0

  const re = /\{\{\{([\s\S]*?)\}\}\}|\{\{([\s\S]*?)\}\}/g

  let match: RegExpExecArray | null
  while ((match = re.exec(template)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'Text', value: template.slice(lastIndex, match.index) })
    }

    const isRaw = match[1] !== undefined
    const inner = (isRaw ? match[1] : match[2])!
    const content = inner.trim()

    if (isRaw) {
      tokens.push({ type: 'RawVariable', value: content })
    } else if (content === 'else') {
      tokens.push({ type: 'Else' })
    } else if (content === '/each') {
      tokens.push({ type: 'EachClose' })
    } else if (content === '/if') {
      tokens.push({ type: 'IfClose' })
    } else if (content === '/unless') {
      tokens.push({ type: 'UnlessClose' })
    } else if (content === '/layout') {
      tokens.push({ type: 'LayoutClose' })
    } else if (/^#each(?:\s+|$)/.test(content)) {
      tokens.push({ type: 'EachOpen', value: content.replace(/^#each\s*/, '').trim() })
    } else if (/^#if(?:\s+|$)/.test(content)) {
      tokens.push({ type: 'IfOpen', value: content.replace(/^#if\s*/, '').trim() })
    } else if (/^#unless(?:\s+|$)/.test(content)) {
      tokens.push({ type: 'UnlessOpen', value: content.replace(/^#unless\s*/, '').trim() })
    } else if (/^#layout(?:\s+|$)/.test(content)) {
      const name = content.replace(/^#layout\s*/, '').trim().replace(/^"|"$/g, '')
      tokens.push({ type: 'LayoutOpen', value: name })
    } else if (content.startsWith('>')) {
      tokens.push({ type: 'Partial', value: content.slice(1).trim() })
    } else if (content.startsWith('#') || content.startsWith('/')) {
      throw new Error(`Unknown tag: ${content}`)
    } else {
      tokens.push({ type: 'Variable', value: content })
    }

    lastIndex = re.lastIndex
  }

  if (lastIndex < template.length) {
    tokens.push({ type: 'Text', value: template.slice(lastIndex) })
  }

  return tokens
}
