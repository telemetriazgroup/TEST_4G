import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { enqueueCommand, fetchSeries, type LiveSnapshot, type SeriesPoint } from '../api'

// ── Types ─────────────────────────────────────────────────────────────────────
type TimeRange = '1h' | '6h' | '24h'
type Status = 'green' | 'amber' | 'red'

type ZoneVal = { id: number; temp: number | null }

// ── Helpers ───────────────────────────────────────────────────────────────────
function zoneStatus(temp: number, setpoint: number): Status {
  const d = Math.abs(temp - setpoint)
  return d >= 1.5 ? 'red' : d >= 0.8 ? 'amber' : 'green'
}

function co2Status(pct: number, setpoint: number | null): Status {
  if (setpoint != null) {
    if (pct > setpoint + 0.4) return 'red'
    if (pct > setpoint + 0.15) return 'amber'
    return 'green'
  }
  return pct >= 1.5 ? 'red' : pct >= 0.8 ? 'amber' : 'green'
}

function humidityStatus(pct: number): Status {
  if (pct < 30 || pct > 80) return 'red'
  if (pct < 40 || pct > 70) return 'amber'
  return 'green'
}

const COLOR: Record<Status, string> = {
  green: 'var(--c-green)',
  amber: 'var(--c-amber)',
  red:   'var(--c-red)',
}

function seededRand(seed: number) {
  let s = seed
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

function generateHistory(base: number, seed: number, len = 120): number[] {
  const rand = seededRand(seed)
  const out: number[] = []
  let v = base - 0.35
  for (let i = 0; i < len; i++) {
    v += (base - v) * 0.04 + (rand() - 0.5) * 0.22
    out.push(+v.toFixed(2))
  }
  return out
}

function freshnessText(sec: number, stale: boolean): string {
  if (stale) return `Sin datos hace ${Math.floor(sec / 60)} min`
  return sec < 60 ? `Actualizado hace ${sec} s` : `Actualizado hace ${Math.floor(sec / 60)} min`
}

function fmtTemp(n: number): string {
  return n.toFixed(1)
}

function fmtPct(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

// ── MiniChart ─────────────────────────────────────────────────────────────────
function MiniChart({ data, color, id }: { data: number[]; color: string; id: string }) {
  const W = 200, H = 36, P = 3
  const lo = Math.min(...data), hi = Math.max(...data)
  const rng = hi - lo || 0.5
  const pts = data.map((v, i) => [
    data.length < 2 ? W / 2 : (i / (data.length - 1)) * W,
    H - P - ((v - lo) / rng) * (H - P * 2),
  ])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x!.toFixed(1)},${y!.toFixed(1)}`).join(' ')
  const fill = `${line} L${W},${H} L0,${H} Z`
  const gid = `cg-${id}`
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gid})`} />
      <path d={line} stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  )
}

// ── RadialGauge ───────────────────────────────────────────────────────────────
function RadialGauge({
  value, max, color, children, size = 112,
}: {
  value: number; max: number; color: string; children: ReactNode; size?: number
}) {
  const r = 36, cx = 50, cy = 50
  const circ = 2 * Math.PI * r   // 226.19
  const arc  = circ * 0.75        // 169.65 — 270° span
  const progress = arc * Math.min(value / max, 1)

  return (
    <div className="relative mx-auto flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="var(--gauge-track)"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circ - arc}`}
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {/* Progress */}
        {progress > 1 && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circ - progress}`}
            transform={`rotate(135 ${cx} ${cy})`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

// ── TruckDiagram ──────────────────────────────────────────────────────────────
const ZONE_TONE = ['#2F6BFF', '#0E9A8A', '#E07A2F', '#7B5EA7']

function TruckDiagram({ zones, setpoint }: { zones: ZoneVal[]; setpoint: number }) {
  const cells = [1, 2, 3, 4].map((id) => {
    const temp = zones.find((z) => z.id === id)?.temp ?? null
    const st: Status = temp == null ? 'green' : zoneStatus(temp, setpoint)
    return { id, temp, st, tone: ZONE_TONE[id - 1] }
  })

  return (
    <div
      className="rounded-[14px] p-4 md:p-5"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--sep)', boxShadow: 'var(--shadow)' }}
    >
      <div className="flex items-center justify-between mb-3 gap-3">
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Furgón refrigerado
        </p>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Consigna {fmtTemp(setpoint)} °C</span>
      </div>
      <div className="flex items-stretch gap-2">
        <div
          className="grid grid-cols-2 gap-2 flex-1 p-2"
          style={{ background: '#F3F7FB', border: '2px solid #12263A', borderRadius: 16 }}
        >
          {cells.map((z) => (
            <div
              key={z.id}
              className="rounded-[12px] px-3 py-3"
              style={{
                background: z.st === 'red' ? 'rgba(226,75,75,0.12)' : z.st === 'amber' ? 'rgba(224,154,43,0.14)' : '#fff',
                border: `2px solid ${z.st === 'red' ? '#E24B4B' : z.st === 'amber' ? '#E09A2B' : z.tone}`,
                boxShadow: z.st === 'red' ? '0 0 0 3px rgba(226,75,75,0.15)' : 'none',
              }}
            >
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12, fontWeight: 700, color: z.tone }}>Zona {z.id}</span>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: COLOR[z.st], display: 'inline-block' }} />
              </div>
              <p className="tabular-nums font-semibold" style={{ fontSize: 28, lineHeight: 1.1, color: z.st === 'red' ? '#E24B4B' : '#1B2430', marginTop: 4 }}>
                {z.temp == null ? '—' : fmtTemp(z.temp)}
                <span style={{ fontSize: 13, fontWeight: 500, color: '#66758A', marginLeft: 4 }}>°C</span>
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-between shrink-0" style={{ width: 72 }}>
          <div className="flex items-center justify-center rounded-[10px]" style={{ width: 56, height: 36, background: '#E8F3FF', color: '#2F6BFF', border: '1px solid #B9D4FF', fontSize: 18 }} title="Equipo de frío">
            ❄
          </div>
          <div className="flex-1 my-1 rounded-[12px] w-full" style={{ background: 'linear-gradient(180deg,#1B3A5C,#12263A)', minHeight: 72, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, left: 8, right: 8, height: 22, borderRadius: 6, background: '#D7E8F8' }} />
          </div>
          <div style={{ width: 22, height: 22, borderRadius: 99, background: '#1B2430', border: '3px solid #C5D0DE' }} />
        </div>
      </div>
      <div className="flex gap-4 mt-3" style={{ fontSize: 12, color: '#66758A' }}>
        <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: 'var(--c-green)', marginRight: 6 }} />En rango</span>
        <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: 'var(--c-amber)', marginRight: 6 }} />Cerca del límite</span>
        <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: 'var(--c-red)', marginRight: 6 }} />Fuera de banda</span>
      </div>
    </div>
  )
}

// ── AlarmBanner ───────────────────────────────────────────────────────────────
function AlarmBanner({ message, onMute }: { message: string; onMute: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const elLabel = elapsed < 60 ? `${elapsed} s` : `${Math.floor(elapsed / 60)} min`

  return (
    <div
      className="fixed inset-x-0 z-30 flex items-center gap-3 px-4 md:px-6 top-11 md:top-14"
      style={{ minHeight: '52px', backgroundColor: '#FF3B30', color: '#fff', paddingTop: '8px', paddingBottom: '8px' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" />
      </svg>
      <div className="flex-1 min-w-0">
        <span style={{ fontSize: '14px', fontWeight: 600 }}>{message}</span>
        <span style={{ fontSize: '12px', opacity: 0.85, marginLeft: '8px' }}>
          · Activa hace {elLabel}
        </span>
      </div>
      <button
        onClick={onMute}
        className="shrink-0 rounded-[8px] px-3 transition-opacity active:opacity-70"
        style={{ height: '36px', backgroundColor: 'rgba(255,255,255,0.22)', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' }}
      >
        Silenciar 10 min
      </button>
    </div>
  )
}

// ── StatusHeader ──────────────────────────────────────────────────────────────
function StatusHeader({
  level, label, freshnessSec, isStale, subtitle,
}: {
  level: string; label: string; freshnessSec: number; isStale: boolean; subtitle: string
}) {
  const statusColor =
    isStale ? 'var(--c-gray)'
    : level === 'normal' ? 'var(--c-green)'
    : level === 'warning' ? 'var(--c-amber)'
    : 'var(--c-red)'

  const headerBg =
    isStale || level === 'normal' ? 'var(--surface)'
    : level === 'warning' ? 'rgba(255, 159, 10, 0.07)'
    : 'rgba(255, 59, 48, 0.08)'

  return (
    <div
      className={isStale ? 'stale-pattern' : ''}
      style={{
        backgroundColor: headerBg,
        border: '1px solid var(--sep)',
        borderRadius: '14px',
        padding: '16px 20px',
        boxShadow: 'var(--shadow)',
        opacity: isStale ? 0.72 : 1,
        transition: 'opacity 0.4s, background-color 0.3s',
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="rounded-full shrink-0"
            style={{ width: '10px', height: '10px', display: 'block', backgroundColor: statusColor }}
          />
          <p
            className="font-semibold leading-tight"
            style={{ fontSize: '20px', color: statusColor, letterSpacing: '-0.02em' }}
          >
            {isStale ? 'Sin datos' : label}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="rounded-full"
            style={{ width: '7px', height: '7px', display: 'block', backgroundColor: isStale ? 'var(--c-gray)' : 'var(--c-green)' }}
          />
          <span style={{ fontSize: '13px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
            {freshnessText(freshnessSec, isStale)}
          </span>
        </div>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '5px', paddingLeft: '22px' }}>
        {subtitle}
      </p>
    </div>
  )
}

// ── TimeRangeSelector ─────────────────────────────────────────────────────────
function TimeRangeSelector({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  return (
    <div className="flex p-[3px] rounded-[10px]" style={{ backgroundColor: 'var(--nav-pill)' }}>
      {(['1h', '6h', '24h'] as TimeRange[]).map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className="rounded-[8px] transition-all"
          style={{
            padding: '6px 16px',
            fontSize: '13px',
            fontWeight: value === opt ? 600 : 400,
            backgroundColor: value === opt ? 'var(--surface)' : 'transparent',
            color: value === opt ? 'var(--text)' : 'var(--text-2)',
            boxShadow: value === opt ? 'var(--shadow)' : 'none',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ── SectionLabel ──────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
      {children}
    </p>
  )
}

// ── ConsignaBadge ─────────────────────────────────────────────────────────────
function ConsignaBadge() {
  return (
    <span
      className="rounded-full"
      style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent)', backgroundColor: 'rgba(0,113,227,0.1)', padding: '2px 6px', letterSpacing: '0.02em' }}
    >
      Consigna
    </span>
  )
}

const TONE: Record<string, string> = {
  supply: '#2F6BFF',
  return_: '#0E9A8A',
  setpoint: '#E07A2F',
  z1: '#2F6BFF',
  z2: '#0E9A8A',
  z3: '#E07A2F',
  z4: '#7B5EA7',
  co2: '#E24B4B',
  humidity: '#2BB3C7',
  motors: '#3AA76D',
}

const ICO = {
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function ParamSvg({ id }: { id: string }) {
  if (id === 'supply') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" {...ICO}>
        <path d="M12 3v8" /><path d="M8 7l4 4 4-4" /><path d="M6 14h12v5a2 2 0 01-2 2H8a2 2 0 01-2-2v-5z" />
      </svg>
    )
  }
  if (id === 'return_') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" {...ICO}>
        <path d="M12 21V13" /><path d="M8 17l4-4 4 4" /><path d="M6 5h12v5H6z" />
      </svg>
    )
  }
  if (id === 'setpoint') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" {...ICO}>
        <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    )
  }
  if (id === 'humidity') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" {...ICO}>
        <path d="M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z" />
      </svg>
    )
  }
  if (id === 'co2') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" {...ICO}>
        <path d="M7 18a4 4 0 010-8 5 5 0 019.5-1.5A3.5 3.5 0 0118 18H7z" />
      </svg>
    )
  }
  if (id === 'motors' || id === 'ventilation') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" {...ICO}>
        <circle cx="12" cy="12" r="2" /><path d="M12 10c2-4 6-4 7-2s-2 5-5 4M14 12c4 2 4 6 2 7s-5-2-4-5M12 14c-2 4-6 4-7 2s2-5 5-4M10 12c-4-2-4-6-2-7s5 2 4 5" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...ICO}>
      <path d="M4 8h16v10H4z" /><path d="M8 8V6h8v2" />
    </svg>
  )
}

function ParamMark({ tone, id }: { tone: string; id: string }) {
  const zone = /^z(\d)$/.exec(id)
  return (
    <span
      className="inline-flex items-center justify-center rounded-[8px] shrink-0"
      style={{ width: 28, height: 28, backgroundColor: `${tone}1A`, color: tone }}
      aria-hidden
    >
      {zone ? <span style={{ fontSize: 13, fontWeight: 700 }}>{zone[1]}</span> : <ParamSvg id={id} />}
    </span>
  )
}

function Trend({ dir }: { dir: 'up' | 'down' | 'flat' }) {
  const color = dir === 'up' ? '#E07A2F' : dir === 'down' ? '#2F6BFF' : '#8A97A8'
  const mark = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '▬'
  const label = dir === 'up' ? 'Sube' : dir === 'down' ? 'Baja' : 'Estable'
  return (
    <span title={label} aria-label={label} style={{ color, fontSize: 16, fontWeight: 700, lineHeight: 1 }}>
      {mark}
    </span>
  )
}

// ── AirCard ───────────────────────────────────────────────────────────────────
function AirCard({
  id, label, value, delta, history, trend = 'flat', isSetpoint = false, stale = false, noData = false,
}: {
  id: string; label: string; value: number; delta: number; trend?: 'up' | 'down' | 'flat';
  history: number[]; isSetpoint?: boolean; stale?: boolean; noData?: boolean
}) {
  const tone = TONE[id] || 'var(--accent)'
  const chartColor = tone
  const borderStyle = isSetpoint ? `1px solid ${tone}` : '1px solid var(--sep)'

  if (noData) {
    return (
      <div className="rounded-[14px] p-4 md:p-5" style={{ backgroundColor: 'var(--surface)', border: borderStyle, boxShadow: 'var(--shadow)' }}>
        <div className="flex items-center gap-2 mb-3">
          <ParamMark tone={tone} id={id} />
          <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{label}</span>
          {isSetpoint && <ConsignaBadge />}
        </div>
        <p className="font-semibold tabular-nums" style={{ fontSize: '40px', color: 'var(--c-gray)', lineHeight: 1 }}>—</p>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '8px' }}>Sin lectura</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-[14px] p-4 md:p-5 flex flex-col gap-3"
      style={{ backgroundColor: 'var(--surface)', border: borderStyle, boxShadow: 'var(--shadow)', opacity: stale ? 0.68 : 1, transition: 'opacity 0.4s' }}
    >
      <div className="flex items-center gap-2">
        <ParamMark tone={tone} id={id} />
        <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{label}</span>
        {isSetpoint && <ConsignaBadge />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="tabular-nums font-semibold text-[44px] md:text-[40px]" style={{ lineHeight: 1, color: tone }}>
          {fmtTemp(value)}
        </span>
        <span style={{ fontSize: '18px', color: 'var(--text-2)' }}>°C</span>
        <Trend dir={trend} />
      </div>
      <div style={{ marginLeft: '-2px', marginRight: '-2px' }}>
        <MiniChart data={history} color={chartColor} id={id} />
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
        {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'}{' '}
        {Math.abs(delta).toFixed(1)} °C en el periodo
      </div>
    </div>
  )
}

// ── ZoneCard ──────────────────────────────────────────────────────────────────
function ZoneCard({ id, temp, setpoint, trend = 'flat', stale = false, noData = false }: {
  id: number; temp: number; setpoint: number; trend?: 'up' | 'down' | 'flat'; stale?: boolean; noData?: boolean
}) {
  const st = zoneStatus(temp, setpoint)
  const tone = TONE[`z${id}`] || 'var(--accent)'
  const borderStyle = st === 'red' ? '2px solid var(--c-red)' : '1px solid var(--sep)'

  if (noData) {
    return (
      <div className="rounded-[14px] p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--sep)', boxShadow: 'var(--shadow)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
            <ParamMark tone={tone} id={`z${id}`} />
            Zona {id}
          </span>
          <span className="rounded-full" style={{ width: '8px', height: '8px', display: 'block', backgroundColor: 'var(--c-gray)' }} />
        </div>
        <p className="tabular-nums font-semibold" style={{ fontSize: '40px', color: 'var(--c-gray)', lineHeight: 1 }}>—</p>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '8px' }}>Sin lectura</p>
      </div>
    )
  }

  const diff = temp - setpoint
  const diffLabel = (diff > 0 ? '+' : '') + fmtTemp(diff) + ' °C del setpoint'

  return (
    <div
      className="rounded-[14px] p-4"
      style={{ backgroundColor: 'var(--surface)', border: borderStyle, boxShadow: 'var(--shadow)', opacity: stale ? 0.68 : 1, transition: 'opacity 0.4s' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
          <ParamMark tone={tone} id={`z${id}`} />
          Zona {id}
        </span>
        <span className="rounded-full" style={{ width: '8px', height: '8px', display: 'block', backgroundColor: COLOR[st] }} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="tabular-nums font-semibold text-[40px] xl:text-[36px]" style={{ lineHeight: 1, color: tone }}>
          {fmtTemp(temp)}
        </span>
        <span style={{ fontSize: '16px', color: 'var(--text-2)' }}>°C</span>
        <Trend dir={trend} />
      </div>
      <p style={{ fontSize: '12px', color: st === 'green' ? 'var(--text-2)' : COLOR[st], marginTop: '8px' }}>
        {diffLabel}
      </p>
    </div>
  )
}

// ── MotorBars ─────────────────────────────────────────────────────────────────
function MotorBars({ speeds }: { speeds: number[] }) {
  return (
    <div className="flex gap-2 mt-2 w-full">
      {speeds.map((speed, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="relative w-full rounded-[4px] overflow-hidden"
            style={{
              height: '32px',
              backgroundColor: speed === 0 ? 'rgba(255,59,48,0.12)' : 'var(--bg)',
              border: speed === 0 ? '1.5px solid var(--c-red)' : 'none',
            }}
          >
            {speed > 0 && (
              <div
                className="absolute bottom-0 w-full rounded-[3px]"
                style={{ height: `${speed}%`, backgroundColor: 'var(--text-2)', opacity: 0.55 }}
              />
            )}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-2)', fontWeight: 500 }}>M{i + 1}</span>
        </div>
      ))}
    </div>
  )
}

// ── AtmoCard ──────────────────────────────────────────────────────────────────
type AtmoType = 'co2' | 'ventilation' | 'motors' | 'humidity'

const ATMO_META: Record<AtmoType, { label: string; unit: string; max: number }> = {
  co2:         { label: 'CO₂',              unit: '%', max: 5 },
  ventilation: { label: 'Ventilación',      unit: '%', max: 100 },
  motors:      { label: 'Ventilación · motores', unit: '%', max: 100 },
  humidity:    { label: 'Humedad relativa', unit: '%', max: 100 },
}

function AtmoCard({
  type, value, motorSpeeds, trend = 'flat', stale = false, noData = false, co2Setpoint = null,
}: {
  type: AtmoType; value: number; motorSpeeds?: number[]; trend?: 'up' | 'down' | 'flat'; stale?: boolean; noData?: boolean; co2Setpoint?: number | null
}) {
  const meta = ATMO_META[type]
  const status: Status =
    type === 'co2' ? co2Status(value, co2Setpoint)
    : type === 'humidity' ? humidityStatus(value)
    : 'green'
  const arcColor = COLOR[status]
  const displayValue = type === 'co2' ? fmtPct(value) : fmtPct(value)

  return (
    <div
      className="rounded-[14px] p-4 flex flex-col items-center gap-2"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--sep)', boxShadow: 'var(--shadow)', opacity: stale ? 0.68 : 1, transition: 'opacity 0.4s' }}
    >
      <p className="flex items-center gap-2" style={{ fontSize: '13px', color: 'var(--text-2)', alignSelf: 'flex-start' }}>
        <ParamMark tone={TONE[type] || '#2F6BFF'} id={type} />
        {meta.label}
      </p>

      {noData ? (
        <>
          <p className="font-semibold tabular-nums" style={{ fontSize: '36px', color: 'var(--c-gray)', lineHeight: 1 }}>—</p>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Sin lectura</p>
        </>
      ) : (
        <>
          <RadialGauge value={value} max={meta.max} color={arcColor} size={108}>
            <span className="tabular-nums font-semibold" style={{ fontSize: '20px', lineHeight: 1, color: 'var(--text)' }}>
              {displayValue}
            </span>
            <Trend dir={trend} />
            <span style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px' }}>
              {meta.unit}
            </span>
          </RadialGauge>

          {type === 'co2' && (
            <p style={{ fontSize: '11px', color: 'var(--text-2)', textAlign: 'center' }}>
              {co2Setpoint != null ? `Consigna ${fmtPct(co2Setpoint)} %` : 'CO₂ en % (cámara)'}
            </p>
          )}

          {type === 'motors' && motorSpeeds && (
            <div className="w-full">
              <MotorBars speeds={motorSpeeds} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Pull-to-refresh indicator ─────────────────────────────────────────────────
function PullIndicator({ distance, refreshing }: { distance: number; refreshing: boolean }) {
  const opacity = Math.min(distance / 60, 1)
  return (
    <div
      className="flex justify-center items-end overflow-hidden"
      style={{ height: distance * 0.65, opacity, transition: refreshing ? 'none' : 'height 0.1s' }}
    >
      <div className="mb-1">
        <svg
          className={refreshing ? 'animate-spin' : ''}
          style={{ transform: refreshing ? undefined : `rotate(${distance * 3}deg)` }}
          width="22" height="22" viewBox="0 0 24 24" fill="none"
        >
          <circle cx="12" cy="12" r="9" stroke="var(--text-2)" strokeOpacity={0.3} strokeWidth={3} />
          <path d="M12 3a9 9 0 019 9" stroke="var(--text-2)" strokeWidth={3} strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

function RelayPanel({ live, canControl }: { live: LiveSnapshot | null; canControl: boolean }) {
  const [busy, setBusy] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const relays = live?.relays || []
  const known = relays.length >= 10 && relays.every((r) => r.on != null)
  const slots = Array.from({ length: 10 }, (_, i) => {
    const found = relays.find((r) => r.id === i + 1)
    return { id: i + 1, name: found?.name || `Relé ${i + 1}`, on: !!found?.on }
  })

  const toggle = async (id: number) => {
    if (!canControl || !known || !live) return
    const bits = slots.map((s) => ((s.id === id ? !s.on : s.on) ? '0' : '1')).join('')
    setBusy(id)
    setNote('')
    try {
      const res = await enqueueCommand({
        ident: live.ident || 'POLLO_BEBE',
        ip: live.ip || null,
        addr: live.addr || null,
        kind: 'relay_set',
        bits,
        label: `Relé ${id}`,
      })
      setNote(res.status === 'queued' ? `Relé ${id} encolado` : `Relé ${id} guardado: el equipo no tiene sesión`)
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'No se pudo enviar el relé')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-8">
      <SectionLabel>Control de relés</SectionLabel>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
        {slots.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={!canControl || !known || busy != null}
            onClick={() => toggle(s.id)}
            className="rounded-[14px] p-3 text-left"
            style={{
              background: 'var(--surface)',
              border: `1px solid ${s.on ? '#3AA76D' : 'var(--sep)'}`,
              boxShadow: 'var(--shadow)',
              opacity: canControl ? 1 : 0.85,
            }}
          >
            <span className="flex items-center justify-between gap-2">
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>R{s.id}</span>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: s.on ? '#3AA76D' : '#C5D0DE', display: 'inline-block' }} />
            </span>
            <span className="block mt-1" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.name}</span>
            <span style={{ fontSize: 12, color: s.on ? '#1F9D55' : '#8A97A8', fontWeight: 700 }}>{busy === s.id ? '…' : s.on ? 'ON' : 'OFF'}</span>
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>
        {canControl
          ? known ? '0 en el bus enciende el relé. El cambio sale en la próxima ventana del equipo.' : 'Aún no hay una lectura completa de los 10 relés.'
          : 'El monitoreo ve el estado. Solo un administrador puede cambiarlos.'}
        {note ? ` ${note}` : ''}
      </p>
    </div>
  )
}

// ── Principal ─────────────────────────────────────────────────────────────────
export default function Principal({
  live,
  freshnessSec = 0,
  isDataStale = false,
  onRefresh,
  canControl = false,
}: {
  live: LiveSnapshot | null
  freshnessSec?: number
  isDataStale?: boolean
  onRefresh?: () => Promise<void> | void
  canControl?: boolean
} = { live: null }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('6h')
  const [points, setPoints] = useState<SeriesPoint[]>([])
  const [alarmMuted, setAlarmMuted] = useState(false)
  const [pullDist, setPullDist] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const isStale = isDataStale || !!(live && live.stale)
  const hours = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : 24

  useEffect(() => {
    let cancel = false
    fetchSeries(hours, live?.ident || 'POLLO_BEBE')
      .then((rows) => { if (!cancel) setPoints(rows) })
      .catch(() => { if (!cancel) setPoints([]) })
    return () => { cancel = true }
  }, [hours, live?.ident, live?.ts])

  const handleMuteAlarm = () => {
    setAlarmMuted(true)
    setTimeout(() => setAlarmMuted(false), 10 * 60 * 1000)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try { await onRefresh?.() } finally {
      setIsRefreshing(false)
      setPullDist(0)
    }
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const scrollTop = containerRef.current?.parentElement?.scrollTop ?? 0
    if (scrollTop > 2 || isRefreshing) return
    const d = e.touches[0].clientY - touchStartY.current
    if (d > 0) setPullDist(Math.min(d * 0.55, 72))
  }
  const onTouchEnd = () => {
    if (pullDist > 60 && !isRefreshing) handleRefresh()
    else if (!isRefreshing) setPullDist(0)
  }

  const held = useRef<Record<string, number>>({})
  const keep = (key: string, value: number | null | undefined) => {
    if (value != null && value !== 0) held.current[key] = value
    if (value == null || value === 0) return held.current[key] ?? null
    return value
  }

  const supply = keep('supply', live?.supply_air_c)
  const retAir = keep('return', live?.return_air_c)
  const humidity = keep('humidity', live?.humidity_pct)
  const setpoint = live?.setpoint_c ?? 24
  const zones: ZoneVal[] = [1, 2, 3, 4].map((id) => ({
    id,
    temp: live?.zones.find((z) => z.id === id)?.temp ?? null,
  }))

  const hist = (key: keyof SeriesPoint, dropZero = false) =>
    points.map((p) => p[key]).filter((v): v is number => typeof v === 'number' && (!dropZero || v !== 0))

  const hSupply = useMemo(() => hist('supply_air_c', true), [points])
  const hReturn = useMemo(() => hist('return_air_c', true), [points])
  const hSetpoint = useMemo(() => hist('setpoint_c'), [points])
  const hHum = useMemo(() => hist('humidity_pct', true), [points])
  const hCo2 = useMemo(() => hist('co2_pct'), [points])
  const hZone = [
    useMemo(() => hist('usda1_c'), [points]),
    useMemo(() => hist('usda2_c'), [points]),
    useMemo(() => hist('usda3_c'), [points]),
    useMemo(() => hist('usda4_c'), [points]),
  ]

  const trendOf = (series: number[]): 'up' | 'down' | 'flat' => {
    if (series.length < 2) return 'flat'
    const d = series[series.length - 1] - series[series.length - 2]
    if (d > 0.05) return 'up'
    if (d < -0.05) return 'down'
    return 'flat'
  }

  const deltaOf = (series: number[], current: number | null) => {
    if (current == null || series.length < 2) return 0
    return +(current - series[0]).toFixed(1)
  }

  const overallStatus = useMemo(() => {
    const withTemp = zones.filter((z) => z.temp != null) as { id: number; temp: number }[]
    const redZ = withTemp.filter((z) => zoneStatus(z.temp, setpoint) === 'red')
    const amberZ = withTemp.filter((z) => zoneStatus(z.temp, setpoint) === 'amber')
    const co2 = live?.co2_pct
    if (redZ.length > 0)
      return {
        level: 'critical',
        label: `Temperatura crítica — Zona${redZ.length > 1 ? 's' : ''} ${redZ.map((z) => z.id).join(', ')}`,
      }
    if (co2 != null && co2Status(co2, live?.co2_setpoint_pct ?? null) === 'red')
      return { level: 'critical', label: `CO₂ alto — ${fmtPct(co2)} %` }
    if (amberZ.length > 0)
      return { level: 'warning', label: `Zona ${amberZ.map((z) => z.id).join(', ')} fuera de banda` }
    if (!live)
      return { level: 'warning', label: 'Esperando datos de la cámara' }
    return { level: 'normal', label: 'Condiciones normales' }
  }, [zones, setpoint, live])

  const alarmActive = overallStatus.level === 'critical' && !alarmMuted
  const motors = live?.motors || []
  const motorSpeeds = motors.map((m) => Math.min(m.speed_pct ?? 0, 100))
  const vent = live?.ventilation_pct
  const subtitle = live
    ? `${live.ident} · ${live.online ? 'equipo en línea' : 'sin sesión'} · ventilación = 4 motores`
    : 'Conectando con la cámara…'

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Critical alarm banner (fixed, only when zones are red) */}
      {alarmActive && (
        <AlarmBanner message={overallStatus.label} onMute={handleMuteAlarm} />
      )}
      {alarmActive && <div style={{ height: '52px' }} />}

      {/* Pull-to-refresh indicator */}
      {(pullDist > 0 || isRefreshing) && (
        <PullIndicator distance={isRefreshing ? 56 : pullDist} refreshing={isRefreshing} />
      )}

      {/* ── Status header ── */}
      <StatusHeader
        level={overallStatus.level}
        label={overallStatus.label}
        freshnessSec={freshnessSec}
        isStale={isStale}
        subtitle={subtitle}
      />

      {/* Stale data notice — appears below header after 60s without data */}
      {isStale && (
        <div
          className="flex items-center gap-2 mt-3 px-3 py-2.5 rounded-[10px]"
          style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--sep)' }}
        >
          <span className="rounded-full shrink-0" style={{ width: '7px', height: '7px', display: 'block', backgroundColor: 'var(--c-gray)' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>
            Mostrando última lectura conocida — los datos no son actuales.
          </span>
        </div>
      )}

      {/* Time range: mobile below header, desktop tucked into block header */}
      <div className="flex md:hidden justify-center mt-3">
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* ── Bloque 1: Condiciones de aire ── */}
      <div className="flex items-center justify-between mt-6 mb-3">
        <SectionLabel>Condiciones de aire</SectionLabel>
        <div className="hidden md:block">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AirCard
          id="supply"
          label="Temperatura suministro"
          value={supply ?? 0}
          trend={trendOf(hSupply)}
          delta={deltaOf(hSupply, supply)}
          history={hSupply.length ? hSupply : supply != null ? [supply] : []}
          stale={isStale}
          noData={supply == null}
        />
        <AirCard
          id="return_"
          label="Temperatura retorno"
          value={retAir ?? 0}
          trend={trendOf(hReturn)}
          delta={deltaOf(hReturn, retAir)}
          history={hReturn.length ? hReturn : retAir != null ? [retAir] : []}
          stale={isStale}
          noData={retAir == null}
        />
        <AirCard
          id="setpoint"
          trend={trendOf(hSetpoint)}
          label="Temperatura"
          value={live?.setpoint_c ?? 0}
          delta={0}
          history={hSetpoint.length ? hSetpoint : [live?.setpoint_c ?? 0]}
          isSetpoint
          stale={isStale}
          noData={live?.setpoint_c == null}
        />
      </div>

      {/* ── Bloque 2: Zonas de carga ── */}
      <div className="mt-8 mb-3">
        <SectionLabel>Zonas de carga</SectionLabel>
      </div>

      {/* On mobile the diagram precedes the cards */}
      <div className="md:hidden mb-4">
        <TruckDiagram zones={zones} setpoint={setpoint} />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {zones.map((z) => (
          <ZoneCard
            key={z.id}
            id={z.id}
            temp={z.temp ?? 0}
            setpoint={setpoint}
            trend={trendOf(hZone[z.id - 1] || [])}
            stale={isStale}
            noData={z.temp == null}
          />
        ))}
      </div>

      <div className="hidden md:block mt-4">
        <TruckDiagram zones={zones} setpoint={setpoint} />
      </div>

      {/* ── Bloque 3: Atmósfera y equipos ── */}
      <div className="mt-8 mb-3">
        <SectionLabel>Atmósfera y equipos</SectionLabel>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <AtmoCard
          type="co2"
          value={live?.co2_pct ?? 0}
          trend={trendOf(hCo2)}
          co2Setpoint={live?.co2_setpoint_pct ?? null}
          stale={isStale}
          noData={live?.co2_pct == null}
        />
        <AtmoCard
          type="humidity"
          value={humidity ?? 0}
          trend={trendOf(hHum)}
          stale={isStale}
          noData={humidity == null}
        />
        <AtmoCard
          type="motors"
          value={vent ?? 0}
          trend="flat"
          motorSpeeds={motorSpeeds.length ? motorSpeeds : [0, 0, 0, 0]}
          stale={isStale}
          noData={vent == null}
        />
      </div>

      <RelayPanel live={live} canControl={canControl} />
    </div>
  )
}
