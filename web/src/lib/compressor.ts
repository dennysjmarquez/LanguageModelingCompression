/**
 * LMC1 container — a real lossless archive that round-trips.
 *
 * Layout:
 *   magic[4] = "LMC1"
 *   version   u8  = 1
 *   method    u8
 *   origLen   u32 BE
 *   bitCount  u32 BE   (arithmetic only; 0 otherwise)
 *   payloadLen u32 BE
 *   payload   bytes
 */
import { acCompress, acDecompress } from './models'
import { huffmanCompress, huffmanDecompress } from './huffman'
import { rleCompress, rleDecompress } from './rle'
import { gzipAvailable, gzipCompress, gzipDecompress } from './gzip'

export const MAGIC = 'LMC1'

export const Method = {
  RLE: 0,
  HUFFMAN: 1,
  AC0: 2,
  AC1: 3,
  AC2: 4,
  AC3: 5,
  GZIP: 6,
} as const

export type MethodId = (typeof Method)[keyof typeof Method]

export const METHOD_META: {
  id: MethodId
  key: string
  name: string
  nameEs: string
  blurb: string
  blurbEs: string
  order?: number
}[] = [
  {
    id: Method.RLE,
    key: 'rle',
    name: 'Run-length',
    nameEs: 'Run-length',
    blurb: 'Transform: collapse consecutive repeats.',
    blurbEs: 'Transformación: colapsa repeticiones consecutivas.',
  },
  {
    id: Method.HUFFMAN,
    key: 'huffman',
    name: 'Huffman',
    nameEs: 'Huffman',
    blurb: 'Entropy coder with integer-length codewords.',
    blurbEs: 'Codificador de entropía con codewords de bits enteros.',
  },
  {
    id: Method.AC0,
    key: 'ac0',
    name: 'Arithmetic order-0',
    nameEs: 'Aritmética order-0',
    blurb: 'Adaptive unigram language model + arithmetic coding.',
    blurbEs: 'Modelo de lenguaje unigramo adaptativo + codificación aritmética.',
    order: 0,
  },
  {
    id: Method.AC1,
    key: 'ac1',
    name: 'Arithmetic order-1',
    nameEs: 'Aritmética order-1',
    blurb: 'P(byte | previous byte). Context cuts the entropy in half on English.',
    blurbEs: 'P(byte | byte anterior). El contexto recorta la entropía a la mitad.',
    order: 1,
  },
  {
    id: Method.AC2,
    key: 'ac2',
    name: 'Arithmetic order-2',
    nameEs: 'Aritmética order-2',
    blurb: 'Bigram context — a tiny character language model.',
    blurbEs: 'Contexto de 2 bytes — un modelo de lenguaje de caracteres.',
    order: 2,
  },
  {
    id: Method.AC3,
    key: 'ac3',
    name: 'Arithmetic order-3',
    nameEs: 'Aritmética order-3',
    blurb: 'Trigram LM. Better prediction → fewer bits.',
    blurbEs: 'LM de trigramas. Mejor predicción → menos bits.',
    order: 3,
  },
  {
    id: Method.GZIP,
    key: 'gzip',
    name: 'gzip (DEFLATE)',
    nameEs: 'gzip (DEFLATE)',
    blurb: 'Industry compressor: LZ77 + Huffman. Tiny overhead, great speed.',
    blurbEs: 'Compresor industrial: LZ77 + Huffman. Overhead minúsculo, gran velocidad.',
  },
]

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4)
  b[0] = (n >>> 24) & 0xff
  b[1] = (n >>> 16) & 0xff
  b[2] = (n >>> 8) & 0xff
  b[3] = n & 0xff
  return b
}

function readU32be(b: Uint8Array, o: number): number {
  return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]
}

export interface CompressResult {
  archive: Uint8Array
  method: MethodId
  origLen: number
  payloadLen: number
  bitCount: number
  crossEntropyBits: number | null
  elapsedMs: number
}

export async function compressBytes(
  data: Uint8Array,
  method: MethodId,
): Promise<CompressResult> {
  const t0 = performance.now()
  let payload: Uint8Array
  let bitCount = 0
  let cross: number | null = null

  switch (method) {
    case Method.RLE:
      payload = rleCompress(data)
      break
    case Method.HUFFMAN:
      payload = huffmanCompress(data)
      break
    case Method.AC0:
    case Method.AC1:
    case Method.AC2:
    case Method.AC3: {
      const order = method - Method.AC0
      const r = acCompress(data, order)
      payload = r.bytes
      bitCount = r.bitCount
      cross = r.crossEntropyBits
      break
    }
    case Method.GZIP:
      payload = await gzipCompress(data)
      break
    default:
      throw new Error('unknown method')
  }

  const header = new Uint8Array(18)
  header[0] = 0x4c // L
  header[1] = 0x4d // M
  header[2] = 0x43 // C
  header[3] = 0x31 // 1
  header[4] = 1
  header[5] = method
  header.set(u32be(data.length), 6)
  header.set(u32be(bitCount), 10)
  header.set(u32be(payload.length), 14)
  const archive = new Uint8Array(header.length + payload.length)
  archive.set(header, 0)
  archive.set(payload, header.length)
  return {
    archive,
    method,
    origLen: data.length,
    payloadLen: archive.length,
    bitCount,
    crossEntropyBits: cross,
    elapsedMs: performance.now() - t0,
  }
}

export async function decompressArchive(archive: Uint8Array): Promise<Uint8Array> {
  if (archive.length < 18) throw new Error('archivo demasiado corto')
  if (
    archive[0] !== 0x4c ||
    archive[1] !== 0x4d ||
    archive[2] !== 0x43 ||
    archive[3] !== 0x31
  ) {
    throw new Error('no es un archivo LMC1')
  }
  const version = archive[4]
  if (version !== 1) throw new Error(`versión no soportada: ${version}`)
  const method = archive[5] as MethodId
  const origLen = readU32be(archive, 6)
  const bitCount = readU32be(archive, 10)
  const payloadLen = readU32be(archive, 14)
  const payload = archive.subarray(18, 18 + payloadLen)

  switch (method) {
    case Method.RLE:
      return rleDecompress(payload)
    case Method.HUFFMAN:
      return huffmanDecompress(payload)
    case Method.AC0:
    case Method.AC1:
    case Method.AC2:
    case Method.AC3:
      return acDecompress(payload, bitCount, origLen, method - Method.AC0)
    case Method.GZIP:
      if (!gzipAvailable()) throw new Error('gzip no disponible')
      return gzipDecompress(payload)
    default:
      throw new Error('método desconocido')
  }
}

export async function compressText(
  text: string,
  method: MethodId,
): Promise<CompressResult> {
  return compressBytes(new TextEncoder().encode(text), method)
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export interface BenchmarkRow {
  method: MethodId
  name: string
  nameEs: string
  origBytes: number
  compressedBytes: number
  bitsPerSymbol: number
  ratio: number
  crossEntropyBits: number | null
  elapsedMs: number
  ok: boolean
  archive: Uint8Array
}

export async function benchmarkAll(text: string): Promise<BenchmarkRow[]> {
  const data = new TextEncoder().encode(text)
  const rows: BenchmarkRow[] = []
  for (const meta of METHOD_META) {
    try {
      const r = await compressBytes(data, meta.id)
      const round = await decompressArchive(r.archive)
      const ok = equalBytes(round, data)
      rows.push({
        method: meta.id,
        name: meta.name,
        nameEs: meta.nameEs,
        origBytes: data.length,
        compressedBytes: r.payloadLen,
        bitsPerSymbol: data.length ? (r.payloadLen * 8) / data.length : 0,
        ratio: data.length ? r.payloadLen / data.length : 0,
        crossEntropyBits: r.crossEntropyBits,
        elapsedMs: r.elapsedMs,
        ok,
        archive: r.archive,
      })
    } catch (err) {
      rows.push({
        method: meta.id,
        name: meta.name,
        nameEs: meta.nameEs,
        origBytes: data.length,
        compressedBytes: data.length,
        bitsPerSymbol: 8,
        ratio: 1,
        crossEntropyBits: null,
        elapsedMs: 0,
        ok: false,
        archive: new Uint8Array(0),
      })
      console.error(err)
    }
  }
  return rows
}

export const SAMPLES: { id: string; label: string; labelEs: string; text: string }[] = [
  {
    id: 'ababaac',
    label: 'ABABAAC (article)',
    labelEs: 'ABABAAC (artículo)',
    text: 'ABABAAC',
  },
  {
    id: 'runs',
    label: 'Long runs',
    labelEs: 'Corridas largas',
    text: 'AAAAAAAAABBBBCCDAAADDDDDDDDD',
  },
  {
    id: 'hamlet',
    label: 'Hamlet',
    labelEs: 'Hamlet',
    text: 'TO BE OR NOT TO BE',
  },
  {
    id: 'dickens',
    label: 'Dickens',
    labelEs: 'Dickens',
    text:
      'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness.',
  },
  {
    id: 'spain',
    label: 'The rain in Spain',
    labelEs: 'The rain in Spain',
    text: 'The rain in Spain falls mainly on the plain.',
  },
  {
    id: 'json',
    label: 'JSON',
    labelEs: 'JSON',
    text: `{
  "model": "order-1",
  "task": "compression",
  "bits": [1, 0, 1, 1, 0],
  "ok": true,
  "nested": { "a": 1, "b": 1, "c": 1 }
}`,
  },
  {
    id: 'code',
    label: 'JavaScript',
    labelEs: 'JavaScript',
    text: `function sumNumbers(numbers) {
  let total = 0;
  for (const number of numbers) {
    total += number;
  }
  return total;
}`,
  },
]
