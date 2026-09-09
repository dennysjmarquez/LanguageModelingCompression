/**
 * Run-length encoding.
 *
 * Educational form matches the article: "AAAAAAAAA" → "A9".
 * Binary form is a general lossless transform used by the compressor.
 */

export interface RleRun {
  char: string
  count: number
}

export function rleRuns(text: string): RleRun[] {
  const runs: RleRun[] = []
  for (const ch of text) {
    const last = runs[runs.length - 1]
    if (last && last.char === ch) last.count++
    else runs.push({ char: ch, count: 1 })
  }
  return runs
}

/** Article-style encoding: A9B4C2… (only safe for digit-free alphabets). */
export function rleEncodeText(text: string): string {
  return rleRuns(text)
    .map((r) => `${r.char}${r.count}`)
    .join('')
}

export function rleDecodeText(encoded: string): string {
  let out = ''
  const re = /([\s\S])(\d+)/g
  let m: RegExpExecArray | null
  let last = 0
  while ((m = re.exec(encoded))) {
    if (m.index !== last) throw new Error('invalid RLE text')
    out += m[1].repeat(Number(m[2]))
    last = re.lastIndex
  }
  if (last !== encoded.length) throw new Error('invalid RLE text')
  return out
}

/**
 * Binary RLE (PackBits-inspired, 1-byte runs).
 * 0x00–0x7F : literal block of (n+1) bytes follow
 * 0x80–0xFF : repeat the next byte (n-0x80+2) times  (2..129)
 */
export function rleCompress(data: Uint8Array): Uint8Array {
  const out: number[] = []
  let i = 0
  while (i < data.length) {
    let run = 1
    while (i + run < data.length && data[i + run] === data[i] && run < 129) {
      run++
    }
    if (run >= 2) {
      out.push(0x80 + (run - 2), data[i])
      i += run
      continue
    }
    const start = i
    i++
    while (i < data.length) {
      run = 1
      while (i + run < data.length && data[i + run] === data[i] && run < 129) {
        run++
      }
      if (run >= 3) break
      i++
      if (i - start >= 128) break
    }
    const lit = data.subarray(start, i)
    out.push(lit.length - 1)
    for (let k = 0; k < lit.length; k++) out.push(lit[k])
  }
  return Uint8Array.from(out)
}

export function rleDecompress(data: Uint8Array): Uint8Array {
  const out: number[] = []
  let i = 0
  while (i < data.length) {
    const n = data[i++]
    if (n >= 0x80) {
      const count = n - 0x80 + 2
      if (i >= data.length) throw new Error('truncated RLE')
      const b = data[i++]
      for (let k = 0; k < count; k++) out.push(b)
    } else {
      const count = n + 1
      if (i + count > data.length) throw new Error('truncated RLE')
      for (let k = 0; k < count; k++) out.push(data[i++])
    }
  }
  return Uint8Array.from(out)
}
