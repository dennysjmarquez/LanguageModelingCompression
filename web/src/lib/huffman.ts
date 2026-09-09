import { BitReader, BitWriter } from './bits'

interface HuffNode {
  freq: number
  symbol: number | null
  left: HuffNode | null
  right: HuffNode | null
  seq: number
}

function buildTree(freq: number[]): HuffNode | null {
  const heap: HuffNode[] = []
  let seq = 0
  for (let s = 0; s < 256; s++) {
    if (freq[s] > 0) {
      heap.push({ freq: freq[s], symbol: s, left: null, right: null, seq: seq++ })
    }
  }
  if (heap.length === 0) return null
  const cmp = (a: HuffNode, b: HuffNode) =>
    a.freq - b.freq || (a.symbol ?? 0) - (b.symbol ?? 0) || a.seq - b.seq
  heap.sort(cmp)
  if (heap.length === 1) {
    return {
      freq: heap[0].freq,
      symbol: null,
      left: heap[0],
      right: heap[0],
      seq: seq++,
    }
  }
  while (heap.length > 1) {
    const a = heap.shift()!
    const b = heap.shift()!
    const parent: HuffNode = {
      freq: a.freq + b.freq,
      symbol: null,
      left: a,
      right: b,
      seq: seq++,
    }
    let i = 0
    while (i < heap.length && cmp(heap[i], parent) <= 0) i++
    heap.splice(i, 0, parent)
  }
  return heap[0]
}

function assignCodes(
  node: HuffNode | null,
  prefix: number[],
  codes: Map<number, number[]>,
): void {
  if (!node) return
  if (node.symbol !== null && node.left === null) {
    codes.set(node.symbol, prefix.length ? prefix.slice() : [0])
    return
  }
  if (node.left && node.right && node.left === node.right) {
    codes.set(node.left.symbol as number, [0])
    return
  }
  if (node.left) assignCodes(node.left, [...prefix, 0], codes)
  if (node.right) assignCodes(node.right, [...prefix, 1], codes)
}

export interface HuffmanTableRow {
  symbol: number
  char: string
  freq: number
  code: string
  bits: number
}

export function huffmanTable(data: Uint8Array): HuffmanTableRow[] {
  const freq = new Array(256).fill(0)
  for (const b of data) freq[b]++
  const tree = buildTree(freq)
  const codes = new Map<number, number[]>()
  assignCodes(tree, [], codes)
  const rows: HuffmanTableRow[] = []
  for (const [symbol, code] of codes) {
    rows.push({
      symbol,
      char: symbol >= 32 && symbol < 127 ? String.fromCharCode(symbol) : `0x${symbol.toString(16)}`,
      freq: freq[symbol],
      code: code.join(''),
      bits: code.length,
    })
  }
  rows.sort((a, b) => b.freq - a.freq || a.symbol - b.symbol)
  return rows
}

export function huffmanCompress(data: Uint8Array): Uint8Array {
  const freq = new Array(256).fill(0)
  for (const b of data) freq[b]++
  const tree = buildTree(freq)
  const codes = new Map<number, number[]>()
  assignCodes(tree, [], codes)

  const used: number[] = []
  for (let s = 0; s < 256; s++) if (freq[s]) used.push(s)

  const header = new Uint8Array(2 + used.length * 5)
  header[0] = (used.length >> 8) & 0xff
  header[1] = used.length & 0xff
  let o = 2
  for (const s of used) {
    header[o++] = s
    const f = freq[s]
    header[o++] = (f >>> 24) & 0xff
    header[o++] = (f >>> 16) & 0xff
    header[o++] = (f >>> 8) & 0xff
    header[o++] = f & 0xff
  }

  const w = new BitWriter()
  for (const b of data) {
    const code = codes.get(b)
    if (!code) throw new Error('missing huffman code')
    for (const bit of code) w.writeBit(bit)
  }
  const payload = w.toBytes()
  const nBits = w.length
  const meta = new Uint8Array(4)
  meta[0] = (nBits >>> 24) & 0xff
  meta[1] = (nBits >>> 16) & 0xff
  meta[2] = (nBits >>> 8) & 0xff
  meta[3] = nBits & 0xff
  const out = new Uint8Array(header.length + 4 + payload.length)
  out.set(header, 0)
  out.set(meta, header.length)
  out.set(payload, header.length + 4)
  return out
}

export function huffmanDecompress(data: Uint8Array): Uint8Array {
  if (data.length < 2) return new Uint8Array(0)
  const nUsed = (data[0] << 8) | data[1]
  const freq = new Array(256).fill(0)
  let o = 2
  for (let i = 0; i < nUsed; i++) {
    const s = data[o++]
    const f =
      ((data[o] << 24) >>> 0) +
      (data[o + 1] << 16) +
      (data[o + 2] << 8) +
      data[o + 3]
    o += 4
    freq[s] = f
  }
  const nBits =
    ((data[o] << 24) >>> 0) + (data[o + 1] << 16) + (data[o + 2] << 8) + data[o + 3]
  o += 4
  const payload = data.subarray(o)
  const tree = buildTree(freq)
  if (!tree) return new Uint8Array(0)

  const total = freq.reduce((a, b) => a + b, 0)
  const reader = new BitReader(payload, nBits)
  const out = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    let node = tree
    while (node.symbol === null) {
      const bit = reader.readBit()
      const next = bit ? node.right : node.left
      if (!next) throw new Error('corrupt huffman stream')
      node = next
      if (node.left === node.right && node.left) {
        node = node.left
        break
      }
    }
    out[i] = node.symbol as number
  }
  return out
}

/** Build a Huffman tree for the animal-guessing demo (any discrete distribution). */
interface HuffNamed {
  id: string
  p: number
  freq: number
  seq: number
  left: HuffNamed | null
  right: HuffNamed | null
  symbol: string | null
}

export function huffmanCodesFromProbs(
  items: { id: string; p: number }[],
): { id: string; p: number; code: string; bits: number }[] {
  const heap: HuffNamed[] = items.map((it, i) => ({
    id: it.id,
    p: it.p,
    freq: Math.max(1, Math.round(it.p * 10000)),
    seq: i,
    left: null,
    right: null,
    symbol: it.id,
  }))
  const cmp = (a: HuffNamed, b: HuffNamed) => a.freq - b.freq || a.seq - b.seq
  heap.sort(cmp)
  let seq = heap.length
  if (heap.length === 1) {
    return [{ id: heap[0].id, p: heap[0].p, code: '0', bits: 1 }]
  }
  while (heap.length > 1) {
    const a = heap.shift()!
    const b = heap.shift()!
    const parent: HuffNamed = {
      id: '',
      p: 0,
      freq: a.freq + b.freq,
      seq: seq++,
      left: a,
      right: b,
      symbol: null,
    }
    let i = 0
    while (i < heap.length && cmp(heap[i], parent) <= 0) i++
    heap.splice(i, 0, parent)
  }
  const codes: { id: string; p: number; code: string; bits: number }[] = []
  const walk = (n: HuffNamed, prefix: string) => {
    if (n.symbol !== null) {
      codes.push({ id: n.id, p: n.p, code: prefix || '0', bits: (prefix || '0').length })
      return
    }
    if (n.left) walk(n.left, prefix + '0')
    if (n.right) walk(n.right, prefix + '1')
  }
  walk(heap[0], '')
  const order = new Map(items.map((it, i) => [it.id, i]))
  codes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  return codes
}
