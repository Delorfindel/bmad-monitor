export function slugify(value: string, maxLength = 60): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, maxLength)
      .replace(/-+$/, '') || 'item'
  )
}

/** Makes `candidate` unique against `used`, and records it. */
export function uniqueSlug(candidate: string, used: Set<string>): string {
  let slug = candidate
  let counter = 2
  while (used.has(slug)) {
    slug = `${candidate}-${counter}`
    counter += 1
  }
  used.add(slug)
  return slug
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escapes the characters that would break a YAML double-quoted scalar. */
export function yamlString(value: string): string {
  return JSON.stringify(value)
}
