/** Bit-level writer / reader used by Huffman and arithmetic coding. */

export class BitWriter {
  private bits: number[] = []

  get length(): number {
    return this.bits.length
  }

  writeBit(bit: number): void {
    this.bits.push(bit & 1)
  }

  writeBits(value: number, n: number): void {
    for (let i = n - 1; i >= 0; i--) {
      this.writeBit((value >>> i) & 1)
    }
  }

  /** Pad to full bytes (zeros) and return the packed buffer. */
  toBytes(): Uint8Array {
    const n = this.bits.length
    const out = new Uint8Array(Math.ceil(n / 8) || 0)
    for (let i = 0; i < n; i++) {
      if (this.bits[i]) out[i >> 3] |= 1 << (7 - (i & 7))
    }
    return out
  }

  toBitArray(): number[] {
    return this.bits.slice()
  }
}

export class BitReader {
  private bits: number[]
  private pos = 0

  constructor(data: Uint8Array, bitCount?: number) {
    const bits: number[] = []
    const limit = bitCount ?? data.length * 8
    for (let i = 0; i < data.length && bits.length < limit; i++) {
      const b = data[i]
      for (let j = 7; j >= 0 && bits.length < limit; j--) {
        bits.push((b >> j) & 1)
      }
    }
    this.bits = bits
  }

  static fromBits(bits: number[]): BitReader {
    const r = Object.create(BitReader.prototype) as BitReader
    r.bits = bits.slice()
    r.pos = 0
    return r
  }

  get remaining(): number {
    return this.bits.length - this.pos
  }

  readBit(): number {
    if (this.pos >= this.bits.length) return 0
    return this.bits[this.pos++]
  }
}

export function bytesToHex(data: Uint8Array, max = 48): string {
  const slice = data.subarray(0, max)
  let s = ''
  for (let i = 0; i < slice.length; i++) {
    s += slice[i].toString(16).padStart(2, '0')
  }
  if (data.length > max) s += '…'
  return s
}

export function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

export function utf8Decode(data: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(data)
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(n)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
