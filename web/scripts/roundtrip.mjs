import { createRequire } from 'node:module'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

// run via: npx tsx scripts/roundtrip.mjs
import { acCompress, acDecompress } from '../src/lib/models.ts'
import { huffmanCompress, huffmanDecompress } from '../src/lib/huffman.ts'
import {
  rleCompress,
  rleDecompress,
  rleEncodeText,
} from '../src/lib/rle.ts'
import {
  compressBytes,
  decompressArchive,
  equalBytes,
  Method,
} from '../src/lib/compressor.ts'
import { encodeSteps, magicNumber } from '../src/lib/visualize.ts'

function u8(s) {
  return new TextEncoder().encode(s)
}
let failed = 0
function check(name, ok) {
  if (!ok) failed++
  console.log(ok ? 'OK   ' : 'FAIL ', name)
}

const texts = [
  '',
  'A',
  'ABABAAC',
  'AAAAAAAAAABC',
  'TO BE OR NOT TO BE',
  'ñandú 日本語 🎉',
  'Hello world '.repeat(40),
]
const dickens =
  'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness.'

check(
  'rle article',
  rleEncodeText('AAAAAAAAABBBBCCDAAADDDDDDDDD') === 'A9B4C2D1A3D9',
)

for (const t of texts) {
  const d = u8(t)
  const label = JSON.stringify(t).slice(0, 24)
  check('rle ' + label, equalBytes(rleDecompress(rleCompress(d)), d))
  check(
    'huff ' + label,
    equalBytes(huffmanDecompress(huffmanCompress(d)), d),
  )
  for (const o of [0, 1, 2, 3]) {
    const r = acCompress(d, o)
    const rec = acDecompress(r.bytes, r.bitCount, r.origLen, o)
    check(`ac${o} ${label} bits=${r.bitCount}`, equalBytes(rec, d))
  }
}

const steps = encodeSteps('ABABAAC', 0)
const last = steps[steps.length - 1]
const magic = magicNumber(last.low, last.high)
console.log('range', last.low, last.high, magic)
check('range low', Math.abs(last.low - 0.3873) < 0.001)
check('range high', Math.abs(last.high - 0.38855) < 0.001)
check('magic 10 bits', magic.bits === 10)

for (const m of [
  Method.RLE,
  Method.HUFFMAN,
  Method.AC0,
  Method.AC1,
  Method.AC2,
  Method.AC3,
]) {
  const d = u8(dickens)
  const r = await compressBytes(d, m)
  const rec = await decompressArchive(r.archive)
  check(
    `lmc method ${m} ${r.payloadLen}B ${r.elapsedMs.toFixed(1)}ms`,
    equalBytes(rec, d),
  )
}

if (failed) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nall passed')
