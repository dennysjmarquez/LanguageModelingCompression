/**
 * Witten–Neal–Cleary arithmetic encoder / decoder (1987).
 * Integer implementation — lossless for any byte string when paired with
 * an identical probabilistic model on both sides.
 */
import { BitReader, BitWriter } from './bits'

// 30 bits keeps every constant inside JS's signed-32 shift range
// (`1 << 31` is negative in JavaScript).
const CODE_BITS = 30
const TOP_VALUE = (1 << CODE_BITS) - 1
const FIRST_QTR = (TOP_VALUE >> 2) + 1
const HALF = FIRST_QTR * 2
const THIRD_QTR = FIRST_QTR * 3

/** Max total frequency so that range never collapses. */
export const MAX_FREQ = FIRST_QTR - 1

export class ArithmeticEncoder {
  private low = 0
  private high = TOP_VALUE
  private pending = 0
  readonly writer = new BitWriter()

  encode(cumLow: number, cumHigh: number, total: number): void {
    if (!(total > 0 && cumLow >= 0 && cumHigh > cumLow && cumHigh <= total)) {
      throw new Error(`invalid interval [${cumLow}, ${cumHigh}) / ${total}`)
    }
    const rng = this.high - this.low + 1
    this.high = this.low + Math.floor((rng * cumHigh) / total) - 1
    this.low = this.low + Math.floor((rng * cumLow) / total)
    this.renormalize()
  }

  finish(): { bytes: Uint8Array; bitCount: number } {
    this.pending += 1
    if (this.low < FIRST_QTR) this.bitPlusFollow(0)
    else this.bitPlusFollow(1)
    const bitCount = this.writer.length
    return { bytes: this.writer.toBytes(), bitCount }
  }

  private bitPlusFollow(bit: number): void {
    this.writer.writeBit(bit)
    const opp = 1 - bit
    while (this.pending > 0) {
      this.writer.writeBit(opp)
      this.pending--
    }
  }

  private renormalize(): void {
    for (;;) {
      if (this.high < HALF) {
        this.bitPlusFollow(0)
      } else if (this.low >= HALF) {
        this.bitPlusFollow(1)
        this.low -= HALF
        this.high -= HALF
      } else if (this.low >= FIRST_QTR && this.high < THIRD_QTR) {
        this.pending++
        this.low -= FIRST_QTR
        this.high -= FIRST_QTR
      } else {
        break
      }
      this.low = this.low * 2
      this.high = this.high * 2 + 1
    }
  }
}

export class ArithmeticDecoder {
  private low = 0
  private high = TOP_VALUE
  private value = 0
  private readonly reader: BitReader

  constructor(bytes: Uint8Array, bitCount: number) {
    this.reader = new BitReader(bytes, bitCount)
    for (let i = 0; i < CODE_BITS; i++) {
      this.value = (this.value << 1) | this.reader.readBit()
    }
  }

  /** Map the current code value onto [0, total). */
  target(total: number): number {
    const rng = this.high - this.low + 1
    return Math.floor(((this.value - this.low + 1) * total - 1) / rng)
  }

  advance(cumLow: number, cumHigh: number, total: number): void {
    const rng = this.high - this.low + 1
    this.high = this.low + Math.floor((rng * cumHigh) / total) - 1
    this.low = this.low + Math.floor((rng * cumLow) / total)
    this.renormalize()
  }

  private renormalize(): void {
    for (;;) {
      if (this.high < HALF) {
        /* keep */
      } else if (this.low >= HALF) {
        this.value -= HALF
        this.low -= HALF
        this.high -= HALF
      } else if (this.low >= FIRST_QTR && this.high < THIRD_QTR) {
        this.value -= FIRST_QTR
        this.low -= FIRST_QTR
        this.high -= FIRST_QTR
      } else {
        break
      }
      this.low = this.low * 2
      this.high = this.high * 2 + 1
      this.value = this.value * 2 + this.reader.readBit()
    }
  }
}

/** Find the symbol whose cumulative interval contains `t`. */
export function findSymbol(
  t: number,
  freq: ArrayLike<number>,
  alphabet: number,
  offset = 1,
): { symbol: number; cumLow: number; cumHigh: number; total: number } {
  let total = 0
  for (let i = 0; i < alphabet; i++) total += freq[i] + offset
  let cum = 0
  for (let i = 0; i < alphabet; i++) {
    const f = freq[i] + offset
    if (cum + f > t) {
      return { symbol: i, cumLow: cum, cumHigh: cum + f, total }
    }
    cum += f
  }
  const last = alphabet - 1
  const f = freq[last] + offset
  return { symbol: last, cumLow: total - f, cumHigh: total, total }
}

export function intervalFor(
  symbol: number,
  freq: ArrayLike<number>,
  alphabet: number,
  offset = 1,
): { cumLow: number; cumHigh: number; total: number } {
  let total = 0
  let cumLow = 0
  for (let i = 0; i < alphabet; i++) {
    const f = freq[i] + offset
    if (i < symbol) cumLow += f
    total += f
  }
  const f = freq[symbol] + offset
  return { cumLow, cumHigh: cumLow + f, total }
}
