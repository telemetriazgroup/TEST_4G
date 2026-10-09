import { useEffect, useState, type CSSProperties } from 'react'
import {
  changePassword,
  createUser,
  fetchRanges,
  fetchUsers,
  saveRanges,
  type ClientUser,
  type ZoneRange,
} from '../api'

const card: CSSProperties = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--sep)',
  borderRadius: 14,
  boxShadow: 'var(--shadow)',
  padding: 20,
}

const field: CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: '1px solid var(--sep)',
  background: 'var(--input-surface)',
  color: 'var(--text)',
  padding: '0 12px',
  width: '100%',
}

const btn: CSSProperties = {
  height: 40,
  borderRadius: 10,
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 600,
  padding: '0 16px',
}

export default function Usuarios({ username, isAdmin }: { username: string; isAdmin: boolean }) {
  const [users, setUsers] = useState<ClientUser[]>([])
  const [ranges, setRanges] = useState<ZoneRange[]>([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ username: '', name: '', password: '', role: 'monitor' })
  const [pwd, setPwd] = useState({ current: '', next: '' })

  const reload = async () => {
    const [u, z] = await Promise.all([fetchUsers(), fetchRanges()])
    setUsers(u)
    setRanges(z)
  }

  useEffect(() => {
    reload().catch((e) => setErr(String(e.message || e)))
  }, [])

  const onCreate = async () => {
    setErr('')
    setMsg('')
    try {
      await createUser(form)
      setForm({ username: '', name: '', password: '', role: 'monitor' })
      setMsg('Usuario creado')
      await reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    }
  }

  const onPassword = async () => {
    setErr('')
    setMsg('')
    try {
      await changePassword(username, pwd.current, pwd.next)
      setPwd({ current: '', next: '' })
      setMsg('Contraseña actualizada')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    }
  }

  const onRanges = async () => {
    setErr('')
    setMsg('')
    try {
      await saveRanges('POLLO_BEBE', ranges)
      setMsg('Rangos de zona guardados')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-semibold" style={{ fontSize: 22 }}>{isAdmin ? 'Usuarios y rangos' : 'Mi cuenta'}</h1>
      {msg && <p style={{ color: 'var(--c-green)', fontSize: 14 }}>{msg}</p>}
      {err && <p style={{ color: 'var(--c-red)', fontSize: 14 }}>{err}</p>}

      {isAdmin && (
        <section style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Crear usuario</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input style={field} placeholder="Usuario" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <input style={field} placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input style={field} type="password" placeholder="Contraseña" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select style={field} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="monitor">Monitoreo — solo información y reportes</option>
              <option value="admin">Administrador — comandos y configuración</option>
            </select>
          </div>
          <button type="button" style={{ ...btn, marginTop: 12 }} onClick={onCreate}>Crear</button>
        </section>
      )}

      {isAdmin && (
        <section style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Cuentas</h2>
          <div className="flex flex-col gap-2">
            {users.map((u) => (
              <div key={u.username} className="flex items-center justify-between" style={{ fontSize: 14 }}>
                <span>{u.name} · {u.username}</span>
                <span style={{ color: 'var(--text-2)' }}>{u.role === 'admin' ? 'Admin' : u.role === 'superadmin' ? 'Superadmin' : 'Monitoreo'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Cambiar mi contraseña</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input style={field} type="password" placeholder="Contraseña actual" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
          <input style={field} type="password" placeholder="Nueva contraseña" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
        </div>
        <button type="button" style={{ ...btn, marginTop: 12 }} onClick={onPassword}>Guardar</button>
      </section>

      {isAdmin && (
        <section style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Rangos de temperatura por zona</h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>Fuera de este intervalo la zona aparece en Avisos.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ranges.map((z, i) => (
              <div key={z.id} className="flex items-center gap-2">
                <span style={{ width: 64, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Zona {z.id}</span>
                <input style={field} type="number" step="0.1" value={z.min} onChange={(e) => {
                  const next = [...ranges]
                  next[i] = { ...z, min: Number(e.target.value) }
                  setRanges(next)
                }} />
                <span style={{ color: 'var(--text-2)' }}>a</span>
                <input style={field} type="number" step="0.1" value={z.max} onChange={(e) => {
                  const next = [...ranges]
                  next[i] = { ...z, max: Number(e.target.value) }
                  setRanges(next)
                }} />
                <span style={{ color: 'var(--text-2)', fontSize: 13 }}>°C</span>
              </div>
            ))}
          </div>
          <button type="button" style={{ ...btn, marginTop: 12 }} onClick={onRanges}>Guardar rangos</button>
        </section>
      )}
    </div>
  )
}
