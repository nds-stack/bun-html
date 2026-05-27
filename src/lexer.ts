import type { Token } from './types.js'

export function tokenize(template: string): Token[] {
  const tokens: Token[] = []
  let lastIndex = 0
  let pendingStripAfter = false
  let line = 1
  let lastLineStart = 0

  function updatePosition(upTo: number): void {
    for (let i = lastLineStart; i < upTo && i < template.length; i++) {
      if (template[i] === '\n') { line++; lastLineStart = i + 1 }
    }
  }

  function addToken(type: Token['type'], value?: string): void {
    const col = lastIndex - lastLineStart + 1
    tokens.push({ type, value, line, column: col })
  }

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
        updatePosition(match.index)
        addToken('Text', text)
      }
    } else if (pendingStripAfter) {
      pendingStripAfter = false
    }

    updatePosition(match.index)

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
      addToken('RawVariable', content)
    } else if (content === 'else') {
      addToken('Else')
    } else if (content === '/each') {
      addToken('EachClose')
    } else if (content === '/if') {
      addToken('IfClose')
    } else if (content === '/unless') {
      addToken('UnlessClose')
    } else if (content === '/with') {
      addToken('WithClose')
    } else if (content === '/def') {
      addToken('DefClose')
    } else if (content === '/layout') {
      addToken('LayoutClose')
    } else if (/^#each(?:\s+|$)/.test(content)) {
      addToken('EachOpen', content.replace(/^#each\s*/, '').trim())
    } else if (/^#if(?:\s+|$)/.test(content)) {
      addToken('IfOpen', content.replace(/^#if\s*/, '').trim())
    } else if (/^#unless(?:\s+|$)/.test(content)) {
      addToken('UnlessOpen', content.replace(/^#unless\s*/, '').trim())
    } else if (/^#with(?:\s+|$)/.test(content)) {
      addToken('WithOpen', content.replace(/^#with\s*/, '').trim())
    } else if (/^#def(?:\s+|$)/.test(content)) {
      const name = content.replace(/^#def\s*/, '').trim().replace(/^"|"$/g, '')
      if (!name) throw new Error(`Def name cannot be empty: "${content}"`)
      if (name.includes('"') || name.includes(' ')) throw new Error(`Invalid def syntax: "${content}"`)
      addToken('DefOpen', name)
    } else if (/^#layout(?:\s+|$)/.test(content)) {
      const name = content.replace(/^#layout\s*/, '').trim().replace(/^"|"$/g, '')
      if (name.includes('"') || name.includes(' ')) throw new Error(`Invalid layout syntax: "${content}"`)
      addToken('LayoutOpen', name)
    } else if (content.startsWith('>')) {
      addToken('Partial', content.slice(1).trim())
    } else if (content.startsWith('#') || content.startsWith('/')) {
      const pos = formatPos(tokens.length > 0 ? tokens[tokens.length - 1] : undefined)
      throw new Error(`Unknown tag: ${content}${pos}`)
    } else {
      addToken('Variable', content)
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
      updatePosition(cleaned.length)
      addToken('Text', text)
    }
  }

  return tokens
}

function formatPos(token: Token | undefined): string {
  if (token?.line !== undefined && token?.column !== undefined) {
    return ` at line ${token.line}, column ${token.column}`
  }
  return ''
}
