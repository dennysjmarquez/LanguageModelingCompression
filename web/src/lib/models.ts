/**
 * Adaptive n-gram language models used as compressors.
 *
 * P(next byte | last k bytes) with Laplace (+1) smoothing and longest-context
 * backoff. Encoder and decoder must start from the same empty tables and
 * update after every symbol — that is the prediction/compression equivalence.
 */
import {
  ArithmeticDecoder,
  ArithmeticEncoder,
  findSymbol,
  intervalFor,
  MAX_FREQ,
} from './arithmetic'

const ALPHABET = 256

function ctxKey(ctx: number[]): string {
  if (ctx.length === 0) return ''
  return String.fromCharCode(...ctx)
}

export class AdaptiveNgram {
  readonly order: number
  /** counts[k] : context-of-length-k → frequencies of next byte */
  private readonly tables: Map<string, Uint32Array>[]
  private readonly totals: Map<string, number>[]

  constructor(order: number) {
    this.order = order
    this.tables = Array.from({ length: order + 1 }, () => new Map())
    this.totals = Array.from({ length: order + 1 }, () => new Map())
  }

  /** Longest context that has been seen at least once; else empty (uniform). */
  private resolve(ctx: number[]): { freq: Uint32Array | null; order: number } {
    const max = Math.min(this.order, ctx.length)
    for (let o = max; o >= 1; o--) {
      const key = ctxKey(ctx.slice(ctx.length - o))
      const freq = this.tables[o].get(key)
      if (freq) return { freq, order: o }
    }
    const freq0 = this.tables[0].get('')
    return { freq: freq0 ?? null, order: 0 }
  }

  interval(symbol: number, ctx: number[]) {
    const { freq } = this.resolve(ctx)
    if (!freq) {
      return { cumLow: symbol, cumHigh: symbol + 1, total: ALPHABET }
    }
    return intervalFor(symbol, freq, ALPHABET, 1)
  }

  lookup(t: number, ctx: number[]) {
    const { freq } = this.resolve(ctx)
    if (!freq) {
      const symbol = Math.min(Math.max(0, t), ALPHABET - 1)
      return { symbol, cumLow: symbol, cumHigh: symbol + 1, total: ALPHABET }
    }
    return findSymbol(t, freq, ALPHABET, 1)
  }

  /** Probability the model currently assigns to `symbol` given `ctx`. */
  probability(symbol: number, ctx: number[]): number {
    const { cumLow, cumHigh, total } = this.interval(symbol, ctx)
    return (cumHigh - cumLow) / total
  }

  /** Full distribution over 256 bytes (for visualizations). */
  distribution(ctx: number[]): { symbol: number; p: number }[] {
    const out: { symbol: number; p: number }[] = []
    for (let s = 0; s < ALPHABET; s++) {
      const { cumLow, cumHigh, total } = this.interval(s, ctx)
      out.push({ symbol: s, p: (cumHigh - cumLow) / total })
    }
    return out
  }

  update(symbol: number, ctx: number[]): void {
    const max = Math.min(this.order, ctx.length)
    for (let o = 0; o <= max; o++) {
      const key = o === 0 ? '' : ctxKey(ctx.slice(ctx.length - o))
      let freq = this.tables[o].get(key)
      if (!freq) {
        freq = new Uint32Array(ALPHABET)
        this.tables[o].set(key, freq)
        this.totals[o].set(key, 0)
      }
      const tot = this.totals[o].get(key) ?? 0
      if (tot + ALPHABET + 1 >= MAX_FREQ) {
        rescale(freq)
        let n = 0
        for (let i = 0; i < ALPHABET; i++) n += freq[i]
        this.totals[o].set(key, n)
      }
      freq[symbol]++
      this.totals[o].set(key, (this.totals[o].get(key) ?? 0) + 1)
    }
  }
}

function rescale(freq: Uint32Array): void {
  for (let i = 0; i < freq.length; i++) {
    freq[i] = (freq[i] + 1) >> 1
  }
}

export interface AcResult {
  bytes: Uint8Array
  bitCount: number
  /** Cross-entropy in bits (sum of −log2 p(symbol|ctx)). */
  crossEntropyBits: number
  origLen: number
}

export function acCompress(data: Uint8Array, order: number): AcResult {
  const model = new AdaptiveNgram(order)
  const enc = new ArithmeticEncoder()
  const ctx: number[] = []
  let cross = 0
  for (let i = 0; i < data.length; i++) {
    const s = data[i]
    const iv = model.interval(s, ctx)
    const p = (iv.cumHigh - iv.cumLow) / iv.total
    cross += p > 0 ? -Math.log2(p) : 0
    enc.encode(iv.cumLow, iv.cumHigh, iv.total)
    model.update(s, ctx)
    ctx.push(s)
    if (ctx.length > order) ctx.shift()
  }
  const { bytes, bitCount } = enc.finish()
  return { bytes, bitCount, crossEntropyBits: cross, origLen: data.length }
}

export function acDecompress(
  bytes: Uint8Array,
  bitCount: number,
  origLen: number,
  order: number,
): Uint8Array {
  if (origLen === 0) return new Uint8Array(0)
  const model = new AdaptiveNgram(order)
  const dec = new ArithmeticDecoder(bytes, bitCount)
  const out = new Uint8Array(origLen)
  const ctx: number[] = []
  for (let i = 0; i < origLen; i++) {
    const dummy = model.interval(0, ctx)
    const t = dec.target(dummy.total)
    const hit = model.lookup(t, ctx)
    dec.advance(hit.cumLow, hit.cumHigh, hit.total)
    out[i] = hit.symbol
    model.update(hit.symbol, ctx)
    ctx.push(hit.symbol)
    if (ctx.length > order) ctx.shift()
  }
  return out
}

/**
 * Static (offline) n-gram: counts are collected from `data` first, then
 * used to encode it. The decoder needs the same counts, so they must be
 * stored — we report both payload-only bits and payload+model bits.
 */
export function staticOrderCounts(
  data: Uint8Array,
  order: 0 | 1,
): Map<string, Uint32Array> {
  const tables = new Map<string, Uint32Array>()
  const ctx: number[] = []
  for (let i = 0; i < data.length; i++) {
    const key = order === 0 ? '' : ctxKey(ctx)
    let freq = tables.get(key)
    if (!freq) {
      freq = new Uint32Array(256)
      tables.set(key, freq)
    }
    freq[data[i]]++
    if (order === 1) {
      ctx.length = 0
      ctx.push(data[i])
    }
  }
  return tables
}

export function modelSizeBytes(tables: Map<string, Uint32Array>): number {
  let n = 0
  for (const [k, freq] of tables) {
    n += k.length + 2
    for (let i = 0; i < 256; i++) if (freq[i]) n += 3
  }
  return n
}
