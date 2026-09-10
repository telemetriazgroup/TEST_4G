import { useState, useEffect, useCallback, type ReactNode } from 'react'
import LoginScreen from './screens/Login'
import Principal from './screens/Principal'
import Configuracion from './screens/Configuracion'
import Administracion from './screens/Administracion'
import Historico from './screens/Historico'
import { fetchLive, type LiveSnapshot, type Session } from './api'

const SESSION_KEY = 'ztrack_client_session'

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function writeStoredSession(session: Session, remember: boolean) {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
  const raw = JSON.stringify(session)
  ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, raw)
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Route = 'principal' | 'configuracion' | 'administracion' | 'historico'
type Dark = boolean | null // true = dark, false = light, null = system

// ── SVG base props ────────────────────────────────────────────────────────────
const S = {
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function IcHome({ sz = 22 }: { sz?: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" {...S}>
      <path d="M3 10L12 3l9 7v10a1 1 0 01-1 1H5a1 1 0 01-1-1V10z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function IcSettings({ sz = 22 }: { sz?: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

function IcAdmin({ sz = 22 }: { sz?: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" {...S}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function IcHistory({ sz = 22 }: { sz?: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IcThermo({ sz = 20 }: { sz?: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" {...S}>
      <path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
    </svg>
  )
}

function IcTruck({ sz = 14 }: { sz?: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" {...S} strokeWidth={2}>
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  )
}

function IcSun({ sz = 18 }: { sz?: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function IcMoon({ sz = 18 }: { sz?: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" {...S}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

function IcMonitor({ sz = 18 }: { sz?: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" {...S}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

// ── Nav definition ────────────────────────────────────────────────────────────
type NavItem = { id: Route; label: string; short: string; Icon: ({ sz }: { sz?: number }) => ReactNode }

const NAV: NavItem[] = [
  { id: 'principal',     label: 'Principal',      short: 'Principal',  Icon: IcHome },
  { id: 'configuracion', label: 'Configuración',  short: 'Config.',    Icon: IcSettings },
  { id: 'administracion',label: 'Administración', short: 'Admin.',     Icon: IcAdmin },
  { id: 'historico',     label: 'Histórico',      short: 'Histórico',  Icon: IcHistory },
]

// ── Connection badge ──────────────────────────────────────────────────────────
function ConnectionBadge({ compact = false, freshnessSec, online = false }: { compact?: boolean; freshnessSec?: number; online?: boolean }) {
  const fStr = freshnessSec !== undefined
    ? freshnessSec < 60 ? ` · ${freshnessSec} s` : ` · ${Math.floor(freshnessSec / 60)} min`
    : ''
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: online ? 'var(--c-green)' : 'var(--c-gray)' }}
      />
      <span style={{ fontSize: compact ? '12px' : '13px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
        {online ? 'En línea' : 'Sin sesión'}{fStr}
      </span>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<Session | null>(readStoredSession)
  const [live, setLive] = useState<LiveSnapshot | null>(null)
  const [route, setRoute] = useState<Route>('principal')
  const [dark, setDark] = useState<Dark>(null)
  const [freshnessSec, setFreshnessSec] = useState(0)
  const [isDataStale, setIsDataStale] = useState(false)
  const authenticated = !!session
  const isAdmin = session?.role === 'admin'

  const loadLive = useCallback(async () => {
    try {
      const snap = await fetchLive(session?.ident || 'POLLO_BEBE')
      setLive(snap)
      setFreshnessSec(snap.age_s ?? 0)
      setIsDataStale(!!snap.stale)
    } catch {
      setIsDataStale(true)
    }
  }, [session?.ident])

  useEffect(() => {
    if (!authenticated) return
    loadLive()
    const poll = setInterval(loadLive, 8000)
    const tick = setInterval(() => {
      setFreshnessSec((s) => {
        const n = s + 1
        if (n >= 60) setIsDataStale(true)
        return n
      })
    }, 1000)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [authenticated, loadLive])

  useEffect(() => {
    if (route === 'administracion' && !isAdmin) setRoute('principal')
    if (route === 'configuracion' && !isAdmin) setRoute('principal')
  }, [route, isAdmin])

  const dataTheme = dark === null ? undefined : dark ? 'dark' : 'light'
  const toggleDark = () => setDark(d => (d === true ? false : true))
  const ThemeIc = dark === true ? IcMoon : dark === false ? IcSun : IcMonitor
  const themeLabel = dark === true ? 'Oscuro' : dark === false ? 'Claro' : 'Sistema'

  const navItems = NAV.filter((n) => {
    if (n.id === 'administracion') return false
    if (n.id === 'configuracion') return isAdmin
    return true
  })

  const screens: Record<Route, ReactNode> = {
    principal:      <Principal live={live} freshnessSec={freshnessSec} isDataStale={isDataStale} onRefresh={loadLive} />,
    configuracion:  <Configuracion live={live} />,
    administracion: <Administracion />,
    historico:      <Historico ident={live?.ident || session?.ident || 'POLLO_BEBE'} />,
  }

  return (
    <div
      data-theme={dataTheme}
      className="h-full"
      style={{
        backgroundColor: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {!authenticated ? (
        <LoginScreen
          onLogin={(next, remember) => {
            writeStoredSession(next, remember)
            setSession(next)
          }}
        />
      ) : (
      <div className="flex h-full overflow-hidden fade-in">
      {/* ── Sidebar (md+) ─────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col shrink-0 w-16 xl:w-60 h-full z-10"
        style={{
          backgroundColor: 'var(--surface-blur)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--sep)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-center xl:justify-start gap-3 xl:px-5 shrink-0"
          style={{ height: '56px', borderBottom: '1px solid var(--sep)' }}
        >
          <span style={{ color: 'var(--accent)', display: 'flex' }}>
            <IcThermo sz={20} />
          </span>
          <span
            className="hidden xl:block font-semibold"
            style={{ fontSize: '15px', letterSpacing: '-0.02em', color: 'var(--text)' }}
          >
            Ztrack
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2 no-scrollbar" style={{ overflowY: 'auto' }}>
          {navItems.map(({ id, label, Icon }) => {
            const active = route === id
            return (
              <button
                key={id}
                onClick={() => setRoute(id)}
                title={label}
                className="w-full flex items-center gap-3 rounded-[10px] mb-0.5 transition-colors justify-center xl:justify-start xl:px-3"
                style={{
                  height: '44px',
                  backgroundColor: active ? 'var(--nav-pill)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-2)',
                }}
              >
                <span className="flex items-center justify-center w-6 h-6 shrink-0">
                  <Icon sz={20} />
                </span>
                <span
                  className="hidden xl:block truncate"
                  style={{ fontSize: '15px', fontWeight: active ? 500 : 400 }}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Footer: theme toggle */}
        <div className="p-2 shrink-0" style={{ borderTop: '1px solid var(--sep)' }}>
          <button
            onClick={toggleDark}
            title={themeLabel}
            className="w-full flex items-center gap-3 rounded-[10px] transition-colors justify-center xl:justify-start xl:px-3"
            style={{ height: '44px', color: 'var(--text-2)' }}
          >
            <span className="flex items-center justify-center w-6 h-6 shrink-0">
              <ThemeIc sz={18} />
            </span>
            <span className="hidden xl:block" style={{ fontSize: '13px' }}>
              {themeLabel}
            </span>
          </button>
        </div>
      </aside>

      {/* ── Main column ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Top bar (md+) */}
        <header
          className="hidden md:flex items-center gap-4 shrink-0 px-6"
          style={{
            height: '56px',
            backgroundColor: 'var(--surface-blur)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--sep)',
          }}
        >
          {/* Trip selector */}
          <button
            className="flex items-center gap-2 rounded-[10px] px-3 transition-colors"
            style={{
              height: '36px',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: 'var(--shadow)',
            }}
          >
            <IcTruck sz={14} />
            <span>{live?.ident || 'POLLO_BEBE'} · {isAdmin ? 'Admin' : 'Monitoreo'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
            <span className="rounded-full" style={{ width: '7px', height: '7px', display: 'block', backgroundColor: isDataStale ? 'var(--c-gray)' : 'var(--c-green)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-2)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {isDataStale ? `Sin datos hace ${Math.floor(freshnessSec / 60)} min` : freshnessSec < 60 ? `Hace ${freshnessSec} s` : `Hace ${Math.floor(freshnessSec / 60)} min`}
            </span>
          </div>

          {/* Avatar */}
          <button
            type="button"
            title="Cerrar sesión"
            onClick={() => {
              clearStoredSession()
              setSession(null)
              setRoute('principal')
            }}
            className="flex items-center justify-center rounded-full shrink-0 select-none font-semibold"
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'var(--sep)',
              color: 'var(--text-2)',
              fontSize: '11px',
              letterSpacing: '0.04em',
            }}
          >
            {(session?.name || 'US').slice(0, 2).toUpperCase()}
          </button>
        </header>

        {/* Mobile header */}
        <header
          className="flex md:hidden items-center gap-2 px-4 shrink-0"
          style={{
            height: '44px',
            backgroundColor: 'var(--surface-blur)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--sep)',
          }}
        >
          <div className="flex-1 min-w-0">
            <p
              className="truncate font-semibold"
              style={{ fontSize: '16px', color: 'var(--text)', letterSpacing: '-0.02em' }}
            >
              {live?.ident || 'POLLO_BEBE'}
            </p>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
            {isDataStale ? `Sin datos ${Math.floor(freshnessSec / 60)} min` : freshnessSec < 60 ? `${freshnessSec} s` : `${Math.floor(freshnessSec / 60)} min`}
          </span>
          <button
            onClick={toggleDark}
            aria-label={themeLabel}
            className="flex items-center justify-center shrink-0"
            style={{ width: '44px', height: '44px', color: 'var(--text-2)' }}
          >
            <ThemeIc sz={18} />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto no-scrollbar">
          <div
            className="p-4 pb-24 md:p-8 mx-auto w-full"
            style={{ maxWidth: '1440px' }}
          >
            {screens[route]}
          </div>
        </main>

        {/* Bottom tab bar (mobile only) */}
        <nav
          className="flex md:hidden fixed bottom-0 inset-x-0 z-20"
          style={{
            backgroundColor: 'var(--surface-blur)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid var(--sep)',
          }}
        >
          <div
            className="flex w-full"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {navItems.map(({ id, short, Icon }) => {
              const active = route === id
              return (
                <button
                  key={id}
                  onClick={() => setRoute(id)}
                  className="flex-1 flex flex-col items-center justify-center"
                  style={{
                    minHeight: '49px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    gap: '3px',
                    color: active ? 'var(--accent)' : 'var(--text-2)',
                  }}
                >
                  <span className="flex items-center justify-center" style={{ width: '24px', height: '24px' }}>
                    <Icon sz={22} />
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: active ? 500 : 400, lineHeight: 1 }}>
                    {short}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
      </div>
      )}
    </div>
  )
}
