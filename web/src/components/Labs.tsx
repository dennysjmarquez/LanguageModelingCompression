import { useMemo, useState } from 'react'
import { minifyJs, SAMPLE_JS } from '../lib/minify'
import { rleRuns } from '../lib/rle'
import {
  decodeSteps,
  encodeSteps,
  labelChar,
  magicNumber,
  probsFromText,
} from '../lib/visualize'
import { huffmanCodesFromProbs } from '../lib/huffman'
import { negLog2 } from '../lib/entropy'
import { acCompress } from '../lib/models'
import { defaultWordLM, SPAIN_SCRIPT } from '../lib/wordlm'
import { RangeBar, GlobalRange } from './RangeBar'
import { utf8Encode } from '../lib/bits'

const RUNS = 'AAAAAAAAABBBBCCDAAADDDDDDDDD'
const ABABAAC = 'ABABAAC'
const HAMLET = 'TO BE OR NOT TO BE'
const DICKENS =
  'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness.'

const ANIMALS = [
  { id: 'bird', es: 'pájaro', p: 0.5 },
  { id: 'squirrel', es: 'ardilla', p: 0.25 },
  { id: 'cat', es: 'gato', p: 0.125 },
  { id: 'fox', es: 'zorro', p: 0.0625 },
  { id: 'bear', es: 'oso', p: 0.0625 },
]

export function MinifyLab() {
  const [on, setOn] = useState(false)
  const out = on ? minifyJs(SAMPLE_JS) : SAMPLE_JS
  const pct = Math.round((1 - out.length / SAMPLE_JS.length) * 100)
  return (
    <section className="section" id="minify">
      <div className="section-head">
        <p className="kicker">01 · Transform</p>
        <h2>Minificación no es compresión</h2>
        <p>
          Quitar comentarios y espacios encoge el archivo, pero no aprovecha
          <em> redundancia</em>. Los compresores de verdad modelan frecuencias.
        </p>
      </div>
      <div className="card">
        <div className="btn-row" style={{ marginBottom: 12 }}>
          <button className="btn primary" onClick={() => setOn(true)}>Minify</button>
          <button className="btn" onClick={() => setOn(false)}>Start over</button>
          <span className="small">
            {out.length} caracteres
            {on ? ` · ${pct}% más pequeño` : ' · original 156+'}
          </span>
        </div>
        <pre className="hex" style={{ whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
          {out}
        </pre>
      </div>
    </section>
  )
}

export function RleLab() {
  const [step, setStep] = useState(0)
  const runs = rleRuns(RUNS)
  const shown = runs.slice(0, step)
  const encoded = shown.map((r) => `${r.char}${r.count}`).join('')
  const done = step >= runs.length
  return (
    <section className="section" id="rle">
      <div className="section-head">
        <p className="kicker">02 · Redundancia</p>
        <h2>Run-length encoding</h2>
        <p>
          El string del artículo — nueve A, cuatro B, dos C, una D, tres A, nueve D —
          se escribe como <code>A9B4C2D1A3D9</code>. 28 caracteres → 12. Eso sí es
          comprimir: el modelo es “los símbolos se repiten en rachas”.
        </p>
      </div>
      <div className="card">
        <div className="string" style={{ marginBottom: 12 }}>
          {runs.flatMap((r, i) =>
            Array.from({ length: r.count }, (_, k) => (
              <span key={`${i}-${k}`} className={'ch' + (i < step ? ' on' : '')}>
                {r.char}
              </span>
            )),
          )}
        </div>
        <div className="btn-row">
          <button className="btn primary" disabled={done} onClick={() => setStep((s) => s + 1)}>
            Encode
          </button>
          <button className="btn" onClick={() => setStep(0)}>Reset</button>
          <span className="mono">{encoded || '—'}</span>
        </div>
        <div className="stats" style={{ marginTop: 14 }}>
          <div className="stat">
            <div className="k">Original</div>
            <div className="v">224 bits</div>
          </div>
          <div className="stat">
            <div className="k">RLE</div>
            <div className="v accent">{done ? '96 bits' : `${encoded.length * 8} bits`}</div>
          </div>
          <div className="stat">
            <div className="k">Ratio</div>
            <div className="v">{done ? '43%' : '—'}</div>
          </div>
        </div>
        <p className="small" style={{ marginTop: 10 }}>
          En el playground, el RLE binario es lossless para cualquier byte — no solo letras.
        </p>
      </div>
    </section>
  )
}

export function Anatomy() {
  return (
    <section className="section" id="anatomia">
      <div className="section-head">
        <p className="kicker">03 · Anatomía</p>
        <h2>Tres órganos de un compresor</h2>
      </div>
      <div className="organs">
        <div className="card organ">
          <h3>Transforms</h3>
          <p className="small">
            Preprocesan. RLE, BWT, delta. A veces agrandan el archivo a cambio de
            crear más redundancia para el modelo.
          </p>
        </div>
        <div className="arrow">→</div>
        <div className="card organ">
          <h3>Model</h3>
          <p className="small">
            Asigna P(símbolo). Unigramo, order-N, PPM, o un LLM. Aquí vive toda la
            magia: mejor predicción = menos bits.
          </p>
        </div>
        <div className="arrow">→</div>
        <div className="card organ">
          <h3>Entropy coder</h3>
          <p className="small">
            Huffman o arithmetic coding. Fijo, determinista, lossless. No se
            “tunea”: solo consume las probabilidades del modelo.
          </p>
        </div>
      </div>
    </section>
  )
}

export function ArithmeticLab() {
  const [text, setText] = useState(ABABAAC)
  const [order, setOrder] = useState<0 | 1>(0)
  const [i, setI] = useState(0)
  const steps = useMemo(() => encodeSteps(text, order), [text, order])
  const step = steps[Math.min(i, steps.length - 1)]
  const last = steps[steps.length - 1]
  const magic = last ? magicNumber(last.low, last.high) : null
  const encodedSym = text.slice(0, Math.min(i, text.length))
  const nextSym = text[i]

  return (
    <section className="section" id="aritmetica">
      <div className="section-head">
        <p className="kicker">04 · Arithmetic coding</p>
        <h2>Un número para todo el mensaje</h2>
        <p>
          Cada símbolo recorta el intervalo [0, 1) a la rebanada que le corresponde.
          Al final, cualquier número dentro del rango bebé representa el mensaje
          entero. Para <code>ABABAAC</code> el artículo llega a{' '}
          <code>[0.38730, 0.38855)</code> y elige <code>0.3876953125</code> — 10 bits
          contra 56 de ASCII.
        </p>
      </div>
      <div className="card">
        <div className="btn-row" style={{ marginBottom: 12 }}>
          <input
            className="input"
            style={{ maxWidth: 360 }}
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, 64))
              setI(0)
            }}
          />
          <div className="tabs">
            <button className={order === 0 ? 'on' : ''} onClick={() => { setOrder(0); setI(0) }}>
              order-0
            </button>
            <button className={order === 1 ? 'on' : ''} onClick={() => { setOrder(1); setI(0) }}>
              order-1
            </button>
          </div>
        </div>
        <div className="string" style={{ marginBottom: 14 }}>
          {[...text].map((ch, idx) => (
            <span key={idx} className={'ch' + (idx < i ? ' on' : idx === i ? '' : ' dim')}>
              {labelChar(ch)}
            </span>
          ))}
        </div>
        {step ? (
          <>
            <RangeBar step={step} highlight={nextSym} />
            <GlobalRange low={step.low} high={step.high} />
          </>
        ) : null}
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn primary" disabled={i >= text.length} onClick={() => setI((x) => x + 1)}>
            Encode {nextSym ? `“${labelChar(nextSym)}”` : ''}
          </button>
          <button className="btn" disabled={i === 0} onClick={() => setI((x) => Math.max(0, x - 1))}>
            Atrás
          </button>
          <button className="btn" onClick={() => setI(0)}>Reset</button>
        </div>
        <div className="stats" style={{ marginTop: 14 }}>
          <div className="stat">
            <div className="k">Codificado</div>
            <div className="v">{encodedSym || '∅'}</div>
          </div>
          <div className="stat">
            <div className="k">−log₂(ancho)</div>
            <div className="v accent">{step ? step.bitsSoFar.toFixed(2) : '0'}</div>
          </div>
          {i >= text.length && magic ? (
            <>
              <div className="stat">
                <div className="k">Número mágico</div>
                <div className="v">{magic.value}</div>
              </div>
              <div className="stat">
                <div className="k">Bits</div>
                <div className="v ok">{magic.bits}</div>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <DecodeLab key={text} text={text} />
    </section>
  )
}

function DecodeLab({ text }: { text: string }) {
  const probs = useMemo(() => probsFromText(text), [text])
  const stepsAll = useMemo(() => encodeSteps(text, 0), [text])
  const last = stepsAll[stepsAll.length - 1]
  const magic = last ? magicNumber(last.low, last.high) : { value: 0, bits: 0, fraction: '', binary: '' }
  const decoded = useMemo(
    () => decodeSteps(magic.value, text.length, probs),
    [magic.value, text.length, probs],
  )
  const [i, setI] = useState(0)
  const step = decoded[Math.min(i, Math.max(decoded.length - 1, 0))]
  const recovered = decoded.slice(0, i).map((d) => d.symbol).join('')

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Descomprimir es el truco de magia inverso</h3>
      <p className="small">
        El decoder recibe el número {magic.value} ({magic.fraction}) y las mismas
        probabilidades. Pregunta: ¿en qué rebanada cae? Ese es el símbolo. Zoom.
        Repite.
      </p>
      {step ? (
        <RangeBar
          step={{ low: step.low, high: step.high, segments: step.segments }}
          highlight={step.symbol}
          marker={magic.value}
        />
      ) : null}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={i >= text.length}
          onClick={() => setI((x) => x + 1)}
        >
          Decode
        </button>
        <button className="btn" onClick={() => setI(0)}>Reset</button>
        <span className="mono">{recovered || '—'}</span>
        {recovered === text && text ? <span className="badge ok">match</span> : null}
      </div>
    </div>
  )
}

export function SkewLab() {
  const a = encodeSteps('ABABAAC', 0)
  const b = encodeSteps('AAAAAAAAAABC', 0)
  const ma = magicNumber(a[a.length - 1].low, a[a.length - 1].high)
  const mb = magicNumber(b[b.length - 1].low, b[b.length - 1].high)
  return (
    <section className="section" id="sesgo">
      <div className="section-head">
        <p className="kicker">05 · Skew</p>
        <h2>Más sesgo, menos bits</h2>
        <p>
          La misma maquinaria, dos strings. El que está dominado por A comprime a
          menos bits por símbolo — la distribución está más lejos de la uniforme.
        </p>
      </div>
      <div className="compare">
        {[
          { title: 'ABABAAC', steps: a, magic: ma, raw: 56 },
          { title: 'AAAAAAAAAABC', steps: b, magic: mb, raw: 96 },
        ].map((col) => {
          const last = col.steps[col.steps.length - 1]
          const n = col.title.length
          return (
            <div className="card" key={col.title}>
              <h3 className="mono">{col.title}</h3>
              <table className="table">
                <tbody>
                  <tr><td>Símbolos</td><td className="num">{n}</td></tr>
                  <tr><td>ASCII</td><td className="num">{col.raw} bits</td></tr>
                  <tr><td>Número</td><td className="num">{col.magic.value}</td></tr>
                  <tr><td>Comprimido</td><td className="num">{col.magic.bits} bits</td></tr>
                  <tr>
                    <td>bits/símbolo</td>
                    <td className="num">{(col.magic.bits / n).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Rango final</td>
                    <td className="num">{last.low.toFixed(5)}–{last.high.toFixed(5)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function EntropyLab() {
  const codes = huffmanCodesFromProbs(ANIMALS)
  return (
    <section className="section" id="entropia">
      <div className="section-head">
        <p className="kicker">06 · Entropía de Shannon</p>
        <h2>El piso de bits</h2>
        <p>
          “Ayer vi un animal…” — si las respuestas se parten por la mitad cada vez,
          el número de preguntas sí/no es exactamente −log₂(p). Eso es un codeword
          de Huffman. Si las probabilidades no son potencias de 1/2, Huffman redondea;
          arithmetic coding no.
        </p>
      </div>
      <div className="formula">
        bits = <span>−log₂(probability)</span>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="animal-tree">
          {ANIMALS.map((a, i) => {
            const c = codes.find((x) => x.id === a.id)!
            return (
              <div className="guess" key={a.id}>
                <strong>{a.es}</strong>
                <div className="bar-h">
                  <i style={{ width: `${a.p * 100}%`, background: `var(--seg-${i})` }} />
                </div>
                <span className="mono">{negLog2(a.p).toFixed(0)} bits</span>
                <span className="mono">{c.code}</span>
              </div>
            )
          })}
        </div>
        <p className="small" style={{ marginTop: 12 }}>
          Entropía media = 1.75 bits/símbolo. Huffman alcanza exactamente ese piso
          aquí porque las p son potencias de dos. En el caso general, arithmetic
          coding se queda a una fracción de bit.
        </p>
      </div>
    </section>
  )
}

export function ContextLab() {
  const [i, setI] = useState(0)
  const steps0 = useMemo(() => encodeSteps(HAMLET, 0), [])
  const steps1 = useMemo(() => encodeSteps(HAMLET, 1), [])
  const [mode, setMode] = useState<0 | 1>(1)
  const steps = mode === 0 ? steps0 : steps1
  const step = steps[Math.min(i, steps.length - 1)]
  const last0 = steps0[steps0.length - 1]
  const last1 = steps1[steps1.length - 1]
  const m0 = magicNumber(last0.low, last0.high)
  const m1 = magicNumber(last1.low, last1.high)

  return (
    <section className="section" id="contexto">
      <div className="section-head">
        <p className="kicker">07 · Contexto</p>
        <h2>P(U) ≈ 0.028 · P(U | Q) ≈ 0.999</h2>
        <p>
          Un modelo order-0 solo mira frecuencias globales. Order-1 pregunta:
          dado el símbolo anterior, ¿qué sigue? En inglés, después de Q casi
          siempre viene U — y −log₂(0.999) ≈ 0.001 bits.
        </p>
      </div>
      <div className="card">
        <div className="string" style={{ marginBottom: 12 }}>
          {[...HAMLET].map((ch, idx) => (
            <span key={idx} className={'ch' + (idx < i ? ' on' : '')}>
              {labelChar(ch)}
            </span>
          ))}
        </div>
        <div className="tabs" style={{ marginBottom: 12 }}>
          <button className={mode === 0 ? 'on' : ''} onClick={() => { setMode(0); setI(0) }}>sin contexto</button>
          <button className={mode === 1 ? 'on' : ''} onClick={() => { setMode(1); setI(0) }}>order-1</button>
        </div>
        {step ? <RangeBar step={step} highlight={HAMLET[i]} /> : null}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={i >= HAMLET.length} onClick={() => setI((x) => x + 1)}>
            Encode
          </button>
          <button className="btn" onClick={() => setI(0)}>Reset</button>
        </div>
        <div className="compare" style={{ marginTop: 16 }}>
          <div>
            <div className="small">sin contexto</div>
            <div className="bit-ticker">{m0.bits} bits</div>
            <div className="small">{(m0.bits / HAMLET.length).toFixed(2)} bits/símbolo</div>
          </div>
          <div>
            <div className="small">order-1</div>
            <div className="bit-ticker">{m1.bits} bits</div>
            <div className="small">{(m1.bits / HAMLET.length).toFixed(2)} bits/símbolo</div>
          </div>
        </div>
        <p className="small">
          El artículo reporta ~47 vs ~21 bits. Nuestros números mágicos (fracción
          binaria más corta en el rango final) coinciden en espíritu: el contexto
          corta el mensaje a más de la mitad.
        </p>
      </div>
    </section>
  )
}

export function LlmLab() {
  const [i, setI] = useState(0)
  const [gen, setGen] = useState<string[]>([])
  const step = SPAIN_SCRIPT[Math.min(i, SPAIN_SCRIPT.length - 1)]
  const totalBits = SPAIN_SCRIPT.slice(0, i).reduce(
    (a, s) => a + negLog2(s.options.find((o) => o.token === s.actual)!.p),
    0,
  )
  const live = defaultWordLM.topK(gen[gen.length - 1] ?? null, 5)

  return (
    <section className="section" id="llm">
      <div className="section-head">
        <p className="kicker">08 · Language modeling</p>
        <h2>El LLM no elige la palabra. Paga por ella.</h2>
        <p>
          En generación, el modelo muestrea el siguiente token. En compresión
          <em> ya sabemos</em> cuál es: usamos la probabilidad que le asignó como
          costo en bits. Si apuesta a “Bermuda” y era “Spain”, −log₂(0.02) = 5.64
          bits en vez de 0.29.
        </p>
      </div>
      <div className="card">
        <div className="bit-ticker">{totalBits.toFixed(2)} bits</div>
        <p className="small">
          Token {Math.min(i + 1, SPAIN_SCRIPT.length)} / {SPAIN_SCRIPT.length}
          {step ? ` · prompt “${step.prompt || '∅'}”` : ''}
        </p>
        <div className="prob-list" style={{ margin: '12px 0' }}>
          {step.options.map((o) => (
            <div className="prob-row" key={o.token}>
              <span className={'tok' + (o.token === step.actual ? ' actual' : '')}>{o.token}</span>
              <div className="prob-bar">
                <i style={{ width: `${o.p * 100}%` }} />
              </div>
              <span className="mono">{o.p.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="btn-row">
          <button
            className="btn primary"
            disabled={i >= SPAIN_SCRIPT.length}
            onClick={() => setI((x) => Math.min(SPAIN_SCRIPT.length, x + 1))}
          >
            Encode “{step.actual}”
          </button>
          <button className="btn" onClick={() => setI(0)}>Reset</button>
        </div>
        <hr className="sep" />
        <h3>Modelo de palabras en vivo (n-grama)</h3>
        <p className="small">
          No es GPT-2: es un bigrama con backoff entrenado en un corpus minúsculo.
          Misma interfaz que un LLM — P(token | contexto) — y por lo tanto, el mismo
          entropy coder puede usarlo.
        </p>
        <div className="btn-row" style={{ margin: '10px 0' }}>
          {live.map((t) => (
            <button
              key={t.token}
              className="tok"
              onClick={() => setGen((g) => [...g, t.token])}
            >
              {JSON.stringify(t.token)} <span className="small">{t.p.toFixed(2)}</span>
            </button>
          ))}
          <button className="btn ghost" onClick={() => setGen([])}>limpiar</button>
        </div>
        <p className="mono">{gen.join('') || '—'}</p>
      </div>
    </section>
  )
}

export function DickensLab() {
  const bytes = utf8Encode(DICKENS)
  const rows = [0, 1, 2, 3].map((order) => {
    const r = acCompress(bytes, order)
    return { order, bits: r.bitCount, cross: r.crossEntropyBits }
  })
  const raw = bytes.length * 8
  return (
    <section className="section" id="dickens">
      <div className="section-head">
        <p className="kicker">09 · Versus GPT-2</p>
        <h2>Mejor modelo, menos bits</h2>
      </div>
      <blockquote className="quote">“{DICKENS}”</blockquote>
      <div className="card" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Modelo</th>
              <th className="num">Bits (payload)</th>
              <th className="num">Cruz-entropía</th>
              <th className="num">% original</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ASCII / UTF-8</td>
              <td className="num">{raw}</td>
              <td className="num">{raw}</td>
              <td className="num">100%</td>
            </tr>
            {rows.map((r) => (
              <tr key={r.order}>
                <td>n-grama adaptativo order-{r.order} + AC</td>
                <td className="num">{r.bits}</td>
                <td className="num">{r.cross.toFixed(1)}</td>
                <td className="num">{((r.bits / raw) * 100).toFixed(0)}%</td>
              </tr>
            ))}
            <tr>
              <td>order-1 (artículo, estático)</td>
              <td className="num">434</td>
              <td className="num">—</td>
              <td className="num">24%</td>
            </tr>
            <tr>
              <td>GPT-2 + arithmetic coding (artículo)</td>
              <td className="num">176</td>
              <td className="num">—</td>
              <td className="num">10%</td>
            </tr>
          </tbody>
        </table>
        <p className="small" style={{ marginTop: 10 }}>
          Nuestros n-gramas adaptativos empiezan uniformes (alfabeto de 256 bytes),
          así que en un texto corto pagan un peaje de arranque. GPT-2 llega
          preentrenado: conocimiento de inglés “gratis” para el bitstream, carísimo
          si cuentas los parámetros del modelo — exactamente el trade-off del paper.
        </p>
      </div>
    </section>
  )
}

export function WildLab() {
  return (
    <section className="section" id="wild">
      <div className="section-head">
        <p className="kicker">10 · En la práctica</p>
        <h2>Dos caras, misma moneda</h2>
        <p>
          Arithmetic coding, de los 70, ya aterriza a un par de bits del piso.
          El problema abierto es bajar la entropía: mejores predictores. Los LLM
          son extraordinarios en eso, y se entrenan minimizando precisamente
          la cruz-entropía — el mismo −log₂(p). No los usamos en HTTP porque el
          navegador tendría que llevarse gigabytes de pesos para ahorrar kilobytes.
        </p>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>gzip / Brotli</h3>
          <p className="small">
            Overhead minúsculo, modelo en el propio bitstream, milisegundos. El
            header <code>Accept-Encoding</code> existe porque el decoder es barato.
          </p>
        </div>
        <div className="card">
          <h3>LLM compressor</h3>
          <p className="small">
            Ratio brutal si ignoras el tamaño del modelo. DeepMind: Chinchilla 70B
            comprime ImageNet a 43.4% (PNG 58.5%) y LibriSpeech a 16.4% (FLAC 30.3%).
          </p>
        </div>
      </div>
    </section>
  )
}
