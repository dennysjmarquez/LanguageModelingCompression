/** gzip via the Web Compression Streams API (Chromium, Firefox, Node 20+). */

export function gzipAvailable(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'
}

async function viaStreams(
  data: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const blob = new Blob([data as BlobPart])
  const out = blob.stream().pipeThrough(stream)
  const buf = await new Response(out).arrayBuffer()
  return new Uint8Array(buf)
}

export async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  if (!gzipAvailable()) throw new Error('gzip no disponible en este entorno')
  return viaStreams(data, new CompressionStream('gzip'))
}

export async function gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
  if (!gzipAvailable()) throw new Error('gzip no disponible en este entorno')
  return viaStreams(data, new DecompressionStream('gzip'))
}
