import { describe, expect, it } from 'vitest'
import { acCompress, acDecompress } from './models'
import { huffmanCompress, huffmanDecompress } from './huffman'
import { rleCompress, rleDecompress, rleDecodeText, rleEncodeText } from './rle'
import {
  compressBytes,
  decompressArchive,
  equalBytes,
  Method,
  SAMPLES,
} from './compressor'
import { encodeSteps, magicNumber } from './visualize'
import { minifyJs, SAMPLE_JS } from './minify'

const TEXTS = [
  '',
  'A',
  'ABABAAC',
  'AAAAAAAAAABC',
  'TO BE OR NOT TO BE',
  'ñandú 日本語 🎉',
  'Hello world '.repeat(80),
  SAMPLES.find((s) => s.id === 'dickens')!.text,
]

function u8(s: string) {
  return new TextEncoder().encode(s)
}

function eq(a: Uint8Array, b: Uint8Array) {
  expect(equalBytes(a, b)).toBe(true)
}

describe('RLE text (article)', () => {
  it('encodes the article example', () => {
    const s = 'AAAAAAAAABBBBCCDAAADDDDDDDDD'
    expect(rleEncodeText(s)).toBe('A9B4C2D1A3D9')
    expect(rleDecodeText('A9B4C2D1A3D9')).toBe(s)
  })
})

describe('RLE binary', () => {
  for (const t of TEXTS) {
    it(`roundtrips ${JSON.stringify(t).slice(0, 40)}`, () => {
      const d = u8(t)
      eq(rleDecompress(rleCompress(d)), d)
    })
  }
})

describe('Huffman', () => {
  for (const t of TEXTS) {
    it(`roundtrips ${JSON.stringify(t).slice(0, 40)}`, () => {
      const d = u8(t)
      eq(huffmanDecompress(huffmanCompress(d)), d)
    })
  }
})

describe('Arithmetic n-gram', () => {
  for (const order of [0, 1, 2, 3]) {
    for (const t of TEXTS) {
      it(`order-${order} ${JSON.stringify(t).slice(0, 30)}`, () => {
        const d = u8(t)
        const r = acCompress(d, order)
        const rec = acDecompress(r.bytes, r.bitCount, r.origLen, order)
        eq(rec, d)
      })
    }
  }
})

describe('LMC1 container', () => {
  const methods = [
    Method.RLE,
    Method.HUFFMAN,
    Method.AC0,
    Method.AC1,
    Method.AC2,
    Method.AC3,
  ]
  for (const m of methods) {
    it(`method ${m} on Dickens`, async () => {
      const d = u8(SAMPLES.find((s) => s.id === 'dickens')!.text)
      const r = await compressBytes(d, m)
      const rec = await decompressArchive(r.archive)
      eq(rec, d)
    })
  }
})

describe('article numbers', () => {
  it('ABABAAC final range matches the article', () => {
    const steps = encodeSteps('ABABAAC', 0)
    const last = steps[steps.length - 1]
    expect(last.low).toBeCloseTo(0.3873, 3)
    expect(last.high).toBeCloseTo(0.38855, 3)
    const magic = magicNumber(last.low, last.high)
    expect(magic.bits).toBe(10)
    expect(magic.value).toBeCloseTo(0.3876953125, 10)
  })
})

describe('minify', () => {
  it('shrinks the sample', () => {
    const out = minifyJs(SAMPLE_JS)
    expect(out.length).toBeLessThan(SAMPLE_JS.length)
    expect(out.includes('function')).toBe(true)
  })
})
