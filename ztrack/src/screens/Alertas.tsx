import { useEffect, useState } from 'react'
import { fetchRanges, type LiveSnapshot, type ZoneRange } from '../api'

export default function Alertas({ live, stale }: { live: LiveSnapshot | null; stale: boolean }) {
  const [ranges, setRanges] = useState<ZoneRange[]>([])

  useEffect(() => {
    fetchRanges(live?.ident || 'POLLO_BEBE').then(setRanges).catch(() => setRanges([]))
  }, [live?.ident])

  const notices: { level: 'crit' | 'warn' | 'ok'; text: string }[] = []
  if (!live) notices.push({ level: 'warn', text: 'Todavía no hay lectura de la cámara.' })
  if (stale) notices.push({ level: 'warn', text: 'La última lectura ya no es actual.' })
  if (live && !live.online) notices.push({ level: 'warn', text: 'El equipo no tiene sesión abierta.' })

  for (const z of live?.zones || []) {
    const band = ranges.find((r) => r.id === z.id)
    if (z.temp == null || !band) continue
    if (z.temp < band.min || z.temp > band.max) {
      notices.push({
        level: 'crit',
        text: `Zona ${z.id} en ${z.temp.toFixed(1)} °C, fuera de ${band.min.toFixed(1)}–${band.max.toFixed(1)} °C`,
      })
    }
  }

  const co2 = live?.co2_pct
  const co2Set = live?.co2_setpoint_pct
  if (co2 != null && co2Set != null && co2 > co2Set) {
    notices.push({ level: 'crit', text: `CO₂ en ${co2.toFixed(2)} %, por encima de la consigna ${co2Set.toFixed(2)} %` })
  } else if (co2 != null && co2 >= 1) {
    notices.push({ level: 'warn', text: `CO₂ en ${co2.toFixed(2)} %` })
  }

  if (!notices.length) notices.push({ level: 'ok', text: 'Sin avisos. Las zonas están dentro del rango configurado.' })

  const color = { crit: 'var(--c-red)', warn: 'var(--c-amber)', ok: 'var(--c-green)' }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-semibold" style={{ fontSize: 22 }}>Alarmas</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
        Aquí quedan los mensajes, también los que se quitaron del panel.
      </p>
      {notices.map((n, i) => (
        <div
          key={i}
          className="flex items-start gap-3"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--sep)',
            borderLeft: `4px solid ${color[n.level]}`,
            borderRadius: 12,
            padding: '14px 16px',
            boxShadow: 'var(--shadow)',
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 99, background: color[n.level], marginTop: 5, flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: 'var(--text)' }}>{n.text}</span>
        </div>
      ))}
    </div>
  )
}
