import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { fetchSeries, seriesField, type LiveSnapshot, type SeriesPoint } from '../api'

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

const FILL_RGBA: Record<Status, string> = {
  green: 'rgba(52, 199, 89, 0.16)',
  amber: 'rgba(255, 159, 10, 0.20)',
  red:   'rgba(255, 59, 48, 0.16)',
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
function TruckDiagram({ zones, setpoint }: { zones: ZoneVal[]; setpoint: number }) {
  const temps = [1, 2, 3, 4].map((id) => zones.find((z) => z.id === id)?.temp ?? null)
  const [s1, s2, s3, s4] = temps.map((t) => (t == null ? 'green' : zoneStatus(t, setpoint))) as Status[]

  return (
    <div
      className="rounded-[14px] p-4"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--sep)', boxShadow: 'var(--shadow)' }}
    >
      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '10px' }}>
        Distribución de zonas
      </p>
      <svg viewBox="0 0 290 100" width="100%" style={{ maxHeight: 100, display: 'block' }}>
        {/* Cargo body outline */}
        <rect x="8" y="10" width="214" height="80" rx="7"
          fill="var(--bg)" stroke="var(--sep)" strokeWidth="1.5" />

        {/* Zone fills */}
        <rect x="9"   y="11" width="106" height="39" rx="6" fill={FILL_RGBA[s1!]} />
        <rect x="115" y="11" width="106" height="39" rx="6" fill={FILL_RGBA[s2!]} />
        <rect x="9"   y="50" width="106" height="39" rx="6" fill={FILL_RGBA[s3!]} />
        <rect x="115" y="50" width="106" height="39" rx="6" fill={FILL_RGBA[s4!]} />

        {/* Internal dividers */}
        <line x1="115" y1="11" x2="115" y2="89" stroke="var(--sep)" strokeWidth="1.5" />
        <line x1="9"   y1="50" x2="221" y2="50" stroke="var(--sep)" strokeWidth="1.5" />

        {/* Zone labels */}
        {([
          [62,  32, 1, s1!],
          [168, 32, 2, s2!],
          [62,  71, 3, s3!],
          [168, 71, 4, s4!],
        ] as [number, number, number, Status][]).map(([x, y, id, st]) => (
          <text key={id} x={x} y={y}
            textAnchor="middle"
            fontSize="12" fontWeight="600"
            fill={COLOR[st]}
            fontFamily="Inter, system-ui, sans-serif"
          >
            Z{id}
          </text>
        ))}

        {/* Cab */}
        <rect x="222" y="22" width="48" height="56" rx="7"
          fill="var(--bg)" stroke="var(--sep)" strokeWidth="1.5" />
        <rect x="229" y="28" width="33" height="20" rx="3"
          fill="var(--sep)" fillOpacity="0.55" />

        {/* Wheels */}
        <rect x="222" y="80" width="16" height="8" rx="4" fill="var(--sep)" />
        <rect x="254" y="80" width="16" height="8" rx="4" fill="var(--sep)" />
        <rect x="8"   y="80" width="16" height="8" rx="4" fill="var(--sep)" />
        <rect x="46"  y="80" width="16" height="8" rx="4" fill="var(--sep)" />

        {/* Direction indicator */}
        <text x="282" y="53" textAnchor="middle" fontSize="12" fill="var(--text-2)" fontFamily="Inter, sans-serif">→</text>
      </svg>
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

// ── AirCard ───────────────────────────────────────────────────────────────────
function AirCard({
  id, label, value, delta, history, isSetpoint = false, stale = false, noData = false,
}: {
  id: string; label: string; value: number; delta: number;
  history: number[]; isSetpoint?: boolean; stale?: boolean; noData?: boolean
}) {
  const chartColor = isSetpoint ? 'var(--accent)' : 'var(--text-2)'
  const borderStyle = isSetpoint ? '1px solid var(--accent)' : '1px solid var(--sep)'

  if (noData) {
    return (
      <div className="rounded-[14px] p-4 md:p-5" style={{ backgroundColor: 'var(--surface)', border: borderStyle, boxShadow: 'var(--shadow)' }}>
        <div className="flex items-center gap-2 mb-3">
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
        <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{label}</span>
        {isSetpoint && <ConsignaBadge />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="tabular-nums font-semibold text-[44px] md:text-[40px]" style={{ lineHeight: 1, color: 'var(--text)' }}>
          {fmtTemp(value)}
        </span>
        <span style={{ fontSize: '18px', color: 'var(--text-2)' }}>°C</span>
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
function ZoneCard({ id, temp, setpoint, stale = false, noData = false }: {
  id: number; temp: number; setpoint: number; stale?: boolean; noData?: boolean
}) {
  const st = zoneStatus(temp, setpoint)
  const borderStyle = st === 'red' ? '2px solid var(--c-red)' : '1px solid var(--sep)'

  if (noData) {
    return (
      <div className="rounded-[14px] p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--sep)', boxShadow: 'var(--shadow)' }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>Zona {id}</span>
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
        <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>Zona {id}</span>
        <span className="rounded-full" style={{ width: '8px', height: '8px', display: 'block', backgroundColor: COLOR[st] }} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="tabular-nums font-semibold text-[40px] xl:text-[36px]" style={{ lineHeight: 1, color: 'var(--text)' }}>
          {fmtTemp(temp)}
        </span>
        <span style={{ fontSize: '16px', color: 'var(--text-2)' }}>°C</span>
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
  type, value, motorSpeeds, stale = false, noData = false, co2Setpoint = null,
}: {
  type: AtmoType; value: number; motorSpeeds?: number[]; stale?: boolean; noData?: boolean; co2Setpoint?: number | null
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
      <p style={{ fontSize: '13px', color: 'var(--text-2)', alignSelf: 'flex-start' }}>
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

// ── Principal ─────────────────────────────────────────────────────────────────
export default function Principal({
  live,
  freshnessSec = 0,
  isDataStale = false,
  onRefresh,
}: {
  live: LiveSnapshot | null
  freshnessSec?: number
  isDataStale?: boolean
  onRefresh?: () => Promise<void> | void
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

  const setpoint = live?.setpoint_c ?? 24
  const zones: ZoneVal[] = [1, 2, 3, 4].map((id) => ({
    id,
    temp: live?.zones.find((z) => z.id === id)?.temp ?? null,
  }))

  const hSupply = useMemo(() => seriesField(points, 'supply_air_c', live?.supply_air_c ?? null), [points, live?.supply_air_c])
  const hReturn = useMemo(() => seriesField(points, 'return_air_c', live?.return_air_c ?? null), [points, live?.return_air_c])
  const hSetpoint = useMemo(() => seriesField(points, 'setpoint_c', live?.setpoint_c ?? null), [points, live?.setpoint_c])

  const deltaOf = (hist: number[], current: number | null) => {
    if (current == null || hist.length < 2) return 0
    return +(current - hist[0]).toFixed(1)
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
          value={live?.supply_air_c ?? 0}
          delta={deltaOf(hSupply, live?.supply_air_c ?? null)}
          history={hSupply.length ? hSupply : [live?.supply_air_c ?? 0]}
          stale={isStale}
          noData={live?.supply_air_c == null}
        />
        <AirCard
          id="return_"
          label="Temperatura retorno"
          value={live?.return_air_c ?? 0}
          delta={deltaOf(hReturn, live?.return_air_c ?? null)}
          history={hReturn.length ? hReturn : [live?.return_air_c ?? 0]}
          stale={isStale}
          noData={live?.return_air_c == null}
        />
        <AirCard
          id="setpoint"
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
          co2Setpoint={live?.co2_setpoint_pct ?? null}
          stale={isStale}
          noData={live?.co2_pct == null}
        />
        <AtmoCard
          type="humidity"
          value={live?.humidity_pct ?? 0}
          stale={isStale}
          noData={live?.humidity_pct == null}
        />
        <AtmoCard
          type="motors"
          value={vent ?? 0}
          motorSpeeds={motorSpeeds.length ? motorSpeeds : [0, 0, 0, 0]}
          stale={isStale}
          noData={vent == null}
        />
      </div>
    </div>
  )
}
