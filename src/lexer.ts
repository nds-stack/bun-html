import type { Token } from './types.js'

export function tokenize(template: string): Token[] {
  const tokens: Token[] = []
  let lastIndex = 0
  let pendingStripAfter = false

  const cleaned = template.replace(/\{\{![\s\S]*?\}\}/g, '')
  const re = /\{\{\{(\~?)([\s\S]*?)(\~?)\}\}\}|\{\{(\~?)([\s\S]*?)(\~?)\}\}/g

  let match: RegExpExecArray | null
  while ((match = re.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      let text = cleaned.slice(lastIndex, match.index)
      if (pendingStripAfter) {
        text = text.replace(/^\s+/, '')
        pendingStripAfter = false
      }
      if (text) {
        tokens.push({ type: 'Text', value: text })
      }
    } else if (pendingStripAfter) {
      pendingStripAfter = false
    }

    const isRaw = match[1] !== undefined
    const stripBefore = !!(isRaw ? match[1] : match[4])
    const inner = (isRaw ? match[2] : match[5])!
    const stripAfter = !!(isRaw ? match[3] : match[6])
    const content = inner.trim()

    if (stripBefore && tokens.length > 0) {
      const last = tokens[tokens.length - 1]!
      if (last.type === 'Text' && last.value) {
        last.value = last.value.replace(/\s+$/, '')
        if (last.value === '') tokens.pop()
      }
    }

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
    } else if (content === '/with') {
      tokens.push({ type: 'WithClose' })
    } else if (content === '/def') {
      tokens.push({ type: 'DefClose' })
    } else if (content === '/layout') {
      tokens.push({ type: 'LayoutClose' })
    } else if (/^#each(?:\s+|$)/.test(content)) {
      tokens.push({ type: 'EachOpen', value: content.replace(/^#each\s*/, '').trim() })
    } else if (/^#if(?:\s+|$)/.test(content)) {
      tokens.push({ type: 'IfOpen', value: content.replace(/^#if\s*/, '').trim() })
    } else if (/^#unless(?:\s+|$)/.test(content)) {
      tokens.push({ type: 'UnlessOpen', value: content.replace(/^#unless\s*/, '').trim() })
    } else if (/^#with(?:\s+|$)/.test(content)) {
      tokens.push({ type: 'WithOpen', value: content.replace(/^#with\s*/, '').trim() })
    } else if (/^#def(?:\s+|$)/.test(content)) {
      const name = content.replace(/^#def\s*/, '').trim().replace(/^"|"$/g, '')
      if (name.includes('"') || name.includes(' ') || !name) throw new Error(`Invalid def syntax: "${content}"`)
      tokens.push({ type: 'DefOpen', value: name })
    } else if (/^#layout(?:\s+|$)/.test(content)) {
      const name = content.replace(/^#layout\s*/, '').trim().replace(/^"|"$/g, '')
      if (name.includes('"') || name.includes(' ')) throw new Error(`Invalid layout syntax: "${content}"`)
      tokens.push({ type: 'LayoutOpen', value: name })
    } else if (content.startsWith('>')) {
      tokens.push({ type: 'Partial', value: content.slice(1).trim() })
    } else if (content.startsWith('#') || content.startsWith('/')) {
      throw new Error(`Unknown tag: ${content}`)
    } else {
      tokens.push({ type: 'Variable', value: content })
    }

    if (stripAfter) {
      pendingStripAfter = true
    }

    lastIndex = re.lastIndex
  }

  if (lastIndex < cleaned.length) {
    let text = cleaned.slice(lastIndex)
    if (pendingStripAfter) {
      text = text.replace(/^\s+/, '')
    }
    if (text) {
      tokens.push({ type: 'Text', value: text })
    }
  }

  return tokens
}
