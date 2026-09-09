/**
 * Exact (rational) arithmetic-coding visualization used by the labs.
 * Range is stored as BigInt numerators over a common denominator so the
 * ABABAAC example lands on the article's [0.38730, 0.38855).
 */

export interface SymbolProb {
  symbol: string
  p: number
  /** exact count / total if available */
  count?: number
}

export interface RangeStep {
  index: number
  symbol: string
  low: number
  high: number
  width: number
  segments: { symbol: string; p: number; low: number; high: number; color: number }[]
  bitsSoFar: number
}

const PALETTE = [0, 1, 2, 3, 4, 5, 6, 7]

export function probsFromText(text: string): SymbolProb[] {
  const counts = new Map<string, number>()
  for (const ch of text) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  const total = text.length || 1
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([symbol, count]) => ({ symbol, p: count / total, count }))
}

export function order1Tables(text: string): Map<string, SymbolProb[]> {
  const joint = new Map<string, Map<string, number>>()
  const first = new Map<string, number>()
  if (!text) return new Map()
  first.set(text[0], 1)
  for (let i = 1; i < text.length; i++) {
    const prev = text[i - 1]
    const ch = text[i]
    if (!joint.has(prev)) joint.set(prev, new Map())
    const m = joint.get(prev)!
    m.set(ch, (m.get(ch) ?? 0) + 1)
  }
  const out = new Map<string, SymbolProb[]>()
  const startTotal = [...first.values()].reduce((a, b) => a + b, 0)
  out.set('', [...first.entries()].map(([symbol, count]) => ({
    symbol,
    p: count / startTotal,
    count,
  })))
  for (const [prev, m] of joint) {
    const tot = [...m.values()].reduce((a, b) => a + b, 0)
    out.set(
      prev,
      [...m.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([symbol, count]) => ({ symbol, p: count / tot, count })),
    )
  }
  return out
}

function segmentsFor(
  probs: SymbolProb[],
  low: number,
  high: number,
): RangeStep['segments'] {
  const width = high - low
  let c = 0
  return probs.map((pr, i) => {
    const sLow = low + width * c
    c += pr.p
    const sHigh = low + width * c
    return {
      symbol: pr.symbol,
      p: pr.p,
      low: sLow,
      high: sHigh,
      color: PALETTE[i % PALETTE.length],
    }
  })
}

export function encodeSteps(
  text: string,
  order: 0 | 1 = 0,
): RangeStep[] {
  const staticProbs = probsFromText(text)
  const tables = order === 1 ? order1Tables(text) : null
  const steps: RangeStep[] = []
  let low = 0
  let high = 1
  const chars = [...text]
  for (let i = 0; i <= chars.length; i++) {
    const ctx = i === 0 ? '' : chars[i - 1]
    const probs =
      order === 0
        ? staticProbs
        : tables!.get(i === 0 ? '' : ctx) ?? staticProbs
    const segs = segmentsFor(probs, low, high)
    const width = high - low
    steps.push({
      index: i,
      symbol: i === 0 ? '' : chars[i - 1],
      low,
      high,
      width,
      segments: segs,
      bitsSoFar: width > 0 ? Math.max(0, -Math.log2(width)) : 0,
    })
    if (i === chars.length) break
    const next = chars[i]
    const seg = segs.find((s) => s.symbol === next)
    if (!seg) break
    low = seg.low
    high = seg.high
  }
  return steps
}

/** Shortest binary fraction inside [low, high). Matches the article's 0.3876953125. */
export function magicNumber(low: number, high: number): {
  value: number
  bits: number
  fraction: string
  binary: string
} {
  if (high <= low) {
    return { value: low, bits: 0, fraction: String(low), binary: '0' }
  }
  for (let bits = 1; bits <= 48; bits++) {
    const scale = 2 ** bits
    const n = Math.ceil(low * scale)
    if (n < 0) continue
    const value = n / scale
    if (value >= low && value < high) {
      return {
        value,
        bits,
        fraction: `${n}/2^${bits}`,
        binary: n.toString(2).padStart(bits, '0'),
      }
    }
  }
  const mid = (low + high) / 2
  return { value: mid, bits: 53, fraction: String(mid), binary: '' }
}

export function decodeSteps(
  value: number,
  length: number,
  probs: SymbolProb[],
): { symbol: string; low: number; high: number; segments: RangeStep['segments'] }[] {
  const out: { symbol: string; low: number; high: number; segments: RangeStep['segments'] }[] = []
  let low = 0
  let high = 1
  for (let i = 0; i < length; i++) {
    const segs = segmentsFor(probs, low, high)
    const hit = segs.find((s) => value >= s.low && value < s.high) ?? segs[segs.length - 1]
    out.push({ symbol: hit.symbol, low, high, segments: segs })
    low = hit.low
    high = hit.high
  }
  return out
}

export function labelChar(ch: string): string {
  if (ch === ' ') return '␣'
  if (ch === '\n') return '↵'
  if (ch === '\t') return '⇥'
  return ch
}
