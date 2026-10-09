import { useEffect, useState, type CSSProperties } from 'react'
import { enqueueCommand, fetchCommandCatalog, type LiveSnapshot } from '../api'

type FieldRow = { idx: number; key: string; label: string; unit?: string; current?: number | null; help?: string }
type ActionRow = { idx: number; key: string; label: string; unit?: string; confirm?: boolean }

const card: CSSProperties = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--sep)',
  borderRadius: 14,
  boxShadow: 'var(--shadow)',
  padding: 16,
}

export default function Comandos({ live, username }: { live: LiveSnapshot | null; username: string }) {
  const [fields, setFields] = useState<FieldRow[]>([])
  const [actions, setActions] = useState<ActionRow[]>([])
  const [values, setValues] = useState<Record<number, string>>({})
  const [online, setOnline] = useState(false)
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    fetchCommandCatalog(live?.ident || 'POLLO_BEBE')
      .then((data) => {
        setFields(data.fields || [])
        setActions(data.actions || [])
        setOnline(!!data.online)
        const seed: Record<number, string> = {}
        for (const f of data.fields || []) {
          if (f.current != null) seed[f.idx] = String(f.current)
        }
        setValues(seed)
      })
      .catch((e) => setErr(e.message || 'Error'))
  }, [live?.ident])

  const send = async (idx: number, value: string | number, label: string) => {
    setErr('')
    setNote('')
    try {
      const res = await enqueueCommand({
        ident: live?.ident || 'POLLO_BEBE',
        ip: live?.ip || null,
        addr: live?.addr || null,
        kind: 'mp5000_write',
        idx,
        value: value === '' ? 1 : Number(value),
        label,
        username,
      })
      setNote(`Encolado en la sesión del serial: ${label}. Si no sale en 10 min se cancela.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold" style={{ fontSize: 22 }}>Comandos del equipo</h1>
        <span style={{ fontSize: 13, color: online ? 'var(--c-green)' : 'var(--c-amber)', fontWeight: 600 }}>
          {online ? 'Sesión del serial' : 'Sin sesión activa — no se puede controlar'}
        </span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
        Los mismos comandos del serial. Un administrador los envía desde aquí; monitoreo no ve esta sección.
      </p>
      {note && <p style={{ color: 'var(--c-green)', fontSize: 14 }}>{note}</p>}
      {err && <p style={{ color: 'var(--c-red)', fontSize: 14 }}>{err}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.idx} style={card} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span style={{ fontWeight: 600, fontSize: 14 }}>{f.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>actual {f.current ?? '—'} {f.unit || ''}</span>
            </div>
            <div className="flex gap-2">
              <input
                value={values[f.idx] ?? ''}
                onChange={(e) => setValues({ ...values, [f.idx]: e.target.value })}
                style={{
                  flex: 1, height: 38, borderRadius: 10, border: '1px solid var(--sep)',
                  padding: '0 12px', color: 'var(--text)', background: 'var(--input-surface)',
                }}
              />
              <button
                type="button"
                disabled={!online}
                onClick={() => send(f.idx, values[f.idx] ?? '', f.label)}
                style={{ height: 38, borderRadius: 10, background: 'var(--accent)', color: '#fff', fontWeight: 600, padding: '0 14px' }}
              >
                Enviar
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>Acciones</h2>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.idx}
            type="button"
            disabled={!online}
            onClick={() => {
              if (a.confirm && !window.confirm(`Enviar “${a.label}”?`)) return
              const extra = a.unit ? window.prompt(`${a.label} (${a.unit})`, '300') : '1'
              if (extra == null) return
              send(a.idx, extra, a.label)
            }}
            style={{
              height: 38, borderRadius: 10, border: '1px solid var(--sep)', background: 'var(--surface)',
              color: 'var(--text)', fontWeight: 600, padding: '0 14px',
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
