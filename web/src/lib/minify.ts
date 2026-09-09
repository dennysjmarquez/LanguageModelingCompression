/** Tiny JS minifier used by the educational lab (not a full parser). */

export const SAMPLE_JS = `// Sum every number in the list
function sumNumbers(numbers) {
  let total = 0;
  for (const number of numbers) {
    total += number;
  }
  return total;
}`

export function minifyJs(source: string): string {
  let s = source.replace(/\/\*[\s\S]*?\*\//g, '')
  s = s.replace(/(^|[^:])\/\/.*$/gm, '$1')
  s = s.replace(/\n+/g, '\n')
  const idMap = new Map<string, string>()
  let n = 0
  const nextName = () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz'
    let name = ''
    let k = n++
    do {
      name = letters[k % 26] + name
      k = Math.floor(k / 26) - 1
    } while (k >= 0)
    return name
  }
  const reserved = new Set([
    'function',
    'return',
    'const',
    'let',
    'var',
    'for',
    'of',
    'in',
    'if',
    'else',
    'while',
    'break',
    'continue',
    'new',
    'this',
    'true',
    'false',
    'null',
    'undefined',
  ])
  s = s.replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, (id) => {
    if (reserved.has(id)) return id
    if (!idMap.has(id)) idMap.set(id, nextName())
    return idMap.get(id)!
  })
  s = s.replace(/\s+/g, ' ')
  s = s.replace(/\s*([{}();,=+*<>!&|?:])\s*/g, '$1')
  return s.trim()
}
