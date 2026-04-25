import type { EntryType } from '../types/entry.js'

export function normalizeTags(input: string[] | string | undefined, type: EntryType): string {
  let tags: string[]

  if (!input) {
    tags = []
  } else if (typeof input === 'string') {
    tags = input.split(',').map(t => t.trim()).filter(t => t.length > 0)
  } else {
    tags = input.filter(t => t.length > 0)
  }

  tags = tags
    .map(t => t.trim())
    .map(t => t.replace(/^#/, ''))
    .map(t => t.toLowerCase())
    .filter(t => t.length > 0)

  tags.push(type)

  tags = [...new Set(tags)]

  tags.sort()

  return tags.join(',')
}
