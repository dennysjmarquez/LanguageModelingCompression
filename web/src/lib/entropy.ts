/** Shannon entropy and related helpers. bits = −log₂(p) */

export function negLog2(p: number): number {
  if (p <= 0) return Infinity
  return -Math.log2(p)
}

export function shannonEntropy(probs: number[]): number {
  let h = 0
  for (const p of probs) {
    if (p > 0) h += p * negLog2(p)
  }
  return h
}

export function symbolCounts(text: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const ch of text) m.set(ch, (m.get(ch) ?? 0) + 1)
  return m
}

export function probabilitiesFromCounts(
  counts: Map<string, number>,
): { symbol: string; count: number; p: number }[] {
  let total = 0
  for (const c of counts.values()) total += c
  const rows = [...counts.entries()].map(([symbol, count]) => ({
    symbol,
    count,
    p: total ? count / total : 0,
  }))
  rows.sort((a, b) => b.p - a.p || a.symbol.localeCompare(b.symbol))
  return rows
}

export function empiricalEntropy(text: string): number {
  const counts = symbolCounts(text)
  const total = text.length || 1
  const probs = [...counts.values()].map((c) => c / total)
  return shannonEntropy(probs)
}

export function formatBits(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '∞'
  return n.toFixed(digits)
}

export function asciiBits(text: string): number {
  return utf8Len(text) * 8
}

export function utf8Len(text: string): number {
  return new TextEncoder().encode(text).length
}

export function ratioPct(compressedBits: number, rawBits: number): number {
  if (!rawBits) return 0
  return (compressedBits / rawBits) * 100
}
