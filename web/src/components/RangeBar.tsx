import { labelChar, type RangeStep } from '../lib/visualize'

const COLORS = [
  'var(--seg-0)',
  'var(--seg-1)',
  'var(--seg-2)',
  'var(--seg-3)',
  'var(--seg-4)',
  'var(--seg-5)',
  'var(--seg-6)',
  'var(--seg-7)',
]

export function RangeBar({
  step,
  highlight,
  marker,
}: {
  step: Pick<RangeStep, 'low' | 'high' | 'segments'>
  highlight?: string
  marker?: number
}) {
  const width = step.high - step.low || 1
  return (
    <div className="range-wrap">
      <div className="range-meta">
        <span>[{step.low.toFixed(5)}, {step.high.toFixed(5)})</span>
        <span>ancho {width.toExponential(2)}</span>
      </div>
      <div className="range-bar">
        {step.segments.map((s) => {
          const frac = (s.high - s.low) / width
          if (frac <= 0) return null
          return (
            <div
              key={s.symbol + s.low}
              className={'seg' + (highlight === s.symbol ? ' hit' : '')}
              style={{
                flex: `${Math.max(frac, 0.0001)} 1 0`,
                background: COLORS[s.color % COLORS.length],
                opacity: highlight && highlight !== s.symbol ? 0.35 : 1,
              }}
              title={`${labelChar(s.symbol)}  p=${s.p.toFixed(3)}`}
            >
              {frac > 0.08 ? labelChar(s.symbol) : ''}
              {frac > 0.14 ? <span className="seg-p">{(s.p * 100).toFixed(0)}%</span> : null}
            </div>
          )
        })}
        {marker !== undefined && marker >= step.low && marker < step.high ? (
          <div
            className="marker"
            style={{ left: `${((marker - step.low) / width) * 100}%` }}
          />
        ) : null}
      </div>
    </div>
  )
}

export function GlobalRange({
  low,
  high,
}: {
  low: number
  high: number
}) {
  return (
    <div className="range-bar" style={{ height: 10, marginTop: 6 }}>
      <div style={{ flex: Math.max(low, 0), background: 'transparent' }} />
      <div
        style={{
          flex: Math.max(high - low, 0.00001),
          background: 'var(--accent)',
          boxShadow: '0 0 12px var(--accent)',
        }}
      />
      <div style={{ flex: Math.max(1 - high, 0), background: 'transparent' }} />
    </div>
  )
}
