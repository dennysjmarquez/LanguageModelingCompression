import { useMemo, useState } from 'react'
import {
  benchmarkAll,
  compressText,
  decompressArchive,
  METHOD_META,
  Method,
  SAMPLES,
  type BenchmarkRow,
  type MethodId,
} from '../lib/compressor'
import { bytesToHex, utf8Decode } from '../lib/bits'
import { empiricalEntropy, utf8Len } from '../lib/entropy'

function download(name: string, data: Uint8Array) {
  const blob = new Blob([data as BlobPart], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function Playground() {
  const [text, setText] = useState(SAMPLES.find((s) => s.id === 'dickens')!.text)
  const [rows, setRows] = useState<BenchmarkRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [method, setMethod] = useState<MethodId>(Method.AC1)
  const [status, setStatus] = useState<string>('')
  const [roundtrip, setRoundtrip] = useState<string>('')

  const raw = useMemo(() => utf8Len(text), [text])
  const h0 = useMemo(() => empiricalEntropy(text), [text])

  async function runAll() {
    setBusy(true)
    setStatus('comprimiendo…')
    try {
      const r = await benchmarkAll(text)
      setRows(r)
      const allOk = r.every((x) => x.ok)
      setStatus(allOk ? 'round-trip lossless en todos los métodos' : 'algún método falló')
    } catch (e) {
      setStatus(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function runOne() {
    setBusy(true)
    setRoundtrip('')
    try {
      const r = await compressText(text, method)
      const rec = await decompressArchive(r.archive)
      const back = utf8Decode(rec)
      const ok = back === text
      setRoundtrip(
        ok
          ? `OK lossless · ${r.archive.length} bytes (${((r.archive.length / Math.max(raw, 1)) * 100).toFixed(1)}% del original) · ${r.elapsedMs.toFixed(1)} ms`
          : 'FALLO: el texto reconstruido no coincide',
      )
      download('texto.lmc', r.archive)
      setStatus(ok ? 'archivo .lmc descargado' : 'error de round-trip')
    } catch (e) {
      setStatus(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onUpload(file: File) {
    setBusy(true)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      if (file.name.endsWith('.lmc') || utf8Decode(buf.subarray(0, 4)) === 'LMC1' || (buf[0] === 0x4c && buf[1] === 0x4d)) {
        const rec = await decompressArchive(buf)
        setText(utf8Decode(rec))
        setStatus(`descomprimido ${file.name} → ${rec.length} bytes`)
      } else {
        setText(utf8Decode(buf))
        setStatus(`cargado ${file.name}`)
      }
    } catch (e) {
      setStatus(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section" id="compresor">
      <div className="section-head">
        <p className="kicker">Compresor real · formato LMC1</p>
        <h2>Playground lossless</h2>
        <p>
          Pega cualquier texto, comprímelo con un modelo de lenguaje (n-grama adaptativo +
          arithmetic coding) y descárgalo como <code>.lmc</code>. El descompresor reconstruye
          <em> exactamente</em> los mismos bytes — el modelo se reconstruye al vuelo, igual que
          en el paper de DeepMind.
        </p>
      </div>

      <div className="card">
        <div className="btn-row" style={{ marginBottom: 10 }}>
          {SAMPLES.map((s) => (
            <button key={s.id} className="btn ghost" onClick={() => setText(s.text)}>
              {s.labelEs}
            </button>
          ))}
        </div>
        <textarea
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
        <div className="stats" style={{ marginTop: 12 }}>
          <div className="stat">
            <div className="k">UTF-8</div>
            <div className="v">{raw} B</div>
          </div>
          <div className="stat">
            <div className="k">ASCII crudo</div>
            <div className="v">{raw * 8} bits</div>
          </div>
          <div className="stat">
            <div className="k">Entropía H₀</div>
            <div className="v accent">{h0.toFixed(2)}</div>
          </div>
          <div className="stat">
            <div className="k">Piso teórico</div>
            <div className="v">{(h0 * [...text].length).toFixed(0)} bits</div>
          </div>
        </div>

        <div className="play-toolbar">
          <select
            className="input"
            style={{ width: 'auto', minWidth: 260 }}
            value={method}
            onChange={(e) => setMethod(Number(e.target.value) as MethodId)}
          >
            {METHOD_META.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameEs}
              </option>
            ))}
          </select>
          <button className="btn primary" disabled={busy} onClick={runOne}>
            Comprimir y descargar .lmc
          </button>
          <button className="btn" disabled={busy} onClick={runAll}>
            Comparar todos
          </button>
          <label className="btn">
            Abrir archivo…
            <input
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onUpload(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        {roundtrip ? (
          <p className="callout">{roundtrip}</p>
        ) : (
          <p className="small">{METHOD_META.find((m) => m.id === method)?.blurbEs}</p>
        )}
        {status ? <p className="small">{status}</p> : null}
      </div>

      {rows ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Comparativa</h3>
          <p className="small">
            Ratio = tamaño_archivo / original. El arithmetic coder cuenta el header LMC1 (18
            bytes). La cruz-entropía es ∑ −log₂ P(s|ctx) — el piso del modelo, sin el header.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Método</th>
                <th className="num">Bytes</th>
                <th className="num">Ratio</th>
                <th className="num">bits/símbolo</th>
                <th className="num">H modelo</th>
                <th className="num">ms</th>
                <th>Round-trip</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.method}>
                  <td>{r.nameEs}</td>
                  <td className="num">{r.compressedBytes}</td>
                  <td className="num">{(r.ratio * 100).toFixed(1)}%</td>
                  <td className="num">{r.bitsPerSymbol.toFixed(2)}</td>
                  <td className="num">
                    {r.crossEntropyBits !== null ? r.crossEntropyBits.toFixed(1) : '—'}
                  </td>
                  <td className="num">{r.elapsedMs.toFixed(1)}</td>
                  <td>
                    {r.ok ? (
                      <span className="badge ok">lossless</span>
                    ) : (
                      <span className="badge warn">error</span>
                    )}
                  </td>
                  <td>
                    <button className="btn ghost" onClick={() => download(`out-${r.method}.lmc`, r.archive)}>
                      .lmc
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows[0] ? (
            <div style={{ marginTop: 14 }}>
              <div className="small">Tamaño relativo (más corto = mejor)</div>
              <div className="ratio-bar" style={{ marginTop: 8 }}>
                {rows.map((r, i) => (
                  <i
                    key={r.method}
                    title={r.nameEs}
                    style={{
                      width: `${Math.max(r.ratio * 100, 2)}%`,
                      background: `var(--seg-${i % 8})`,
                    }}
                  />
                ))}
              </div>
              <div className="legend" style={{ marginTop: 8 }}>
                {rows.map((r, i) => (
                  <span key={r.method}>
                    <span className="swatch" style={{ background: `var(--seg-${i % 8})` }} />
                    {r.nameEs}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {rows.find((r) => r.method === Method.AC1) ? (
            <pre className="hex" style={{ marginTop: 14 }}>
              AC1 hex: {bytesToHex(rows.find((r) => r.method === Method.AC1)!.archive, 64)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
