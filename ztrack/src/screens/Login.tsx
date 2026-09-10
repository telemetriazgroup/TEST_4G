import { useState, type FormEvent } from 'react'

type FormState = 'idle' | 'loading' | 'error' | 'offline'

// ── SVG base ──────────────────────────────────────────────────────────────────
const SB = {
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function IcEyeOpen({ sz = 18 }: { sz?: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" {...SB} strokeWidth={1.75}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IcEyeOff({ sz = 18 }: { sz?: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" {...SB} strokeWidth={1.75}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function IcWifiOff({ sz = 18 }: { sz?: number }) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" {...SB} strokeWidth={1.75}>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
      <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0122.56 9" />
      <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
      <path d="M8.53 16.11a6 6 0 016.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth={2.5} />
    </svg>
  )
}

function Spinner({ sz = 16 }: { sz?: number }) {
  return (
    <svg className="animate-spin" width={sz} height={sz} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.28} strokeWidth={3} />
      <path d="M12 3a9 9 0 019 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  )
}

// ── Logo ─────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="flex items-center gap-2.5" style={{ color: 'var(--text)', height: '40px' }}>
      <span
        style={{
          fontSize: '21px',
          fontWeight: 700,
          letterSpacing: '-0.05em',
          lineHeight: 1,
          fontFamily: "'Inter', -apple-system, sans-serif",
        }}
      >
        Ztrack Monitor
      </span>
    </div>
  )
}

// ── Checkmark ────────────────────────────────────────────────────────────────
function Checkmark() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
      <path d="M1 3.5L3.5 6.5L9 1" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
type LocalSession = { role: 'admin' | 'monitor' | 'superadmin'; name: string; username: string; ident: string }

const LOCAL_USERS: Record<string, { password: string; session: LocalSession }> = {
  demo: { password: 'demo', session: { role: 'admin', name: 'Demo', username: 'demo', ident: 'POLLO_BEBE' } },
  admin: { password: 'admin', session: { role: 'admin', name: 'Administrador', username: 'admin', ident: 'POLLO_BEBE' } },
  monitor: { password: 'monitor', session: { role: 'monitor', name: 'Monitoreo', username: 'monitor', ident: 'POLLO_BEBE' } },
  superadmin: { password: 'superadmin', session: { role: 'superadmin', name: 'Superadmin', username: 'superadmin', ident: 'POLLO_BEBE' } },
}

export default function LoginScreen({ onLogin }: { onLogin: (session: LocalSession, remember: boolean) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(true)
  const [formState, setFormState] = useState<FormState>('idle')
  const [focused, setFocused] = useState<'user' | 'pass' | null>(null)

  const isLoading = formState === 'loading'
  const isError = formState === 'error'
  const isOffline = formState === 'offline'
  const isGroupFocused = focused !== null

  const finishLogin = (session: LocalSession) => {
    if (session.role === 'superadmin') {
      window.location.href = (import.meta.env.VITE_SERIAL_URL as string) || 'http://localhost:8089'
      return
    }
    onLogin(session, remember)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim() || isLoading) return
    const key = username.trim().toLowerCase()
    if (key === 'offline') {
      setFormState('offline')
      return
    }
    setFormState('loading')
    try {
      const { clientLogin } = await import('../api')
      const session = await clientLogin(username, password)
      finishLogin(session)
      return
    } catch {
      const match = LOCAL_USERS[key]
      if (match && match.password === password) {
        finishLogin(match.session)
        return
      }
      setFormState('error')
    }
  }

  const resetForm = () => {
    setFormState('idle')
  }

  // Input group border/shadow: error > focus > idle
  const groupBorder = isError
    ? 'var(--c-red)'
    : isGroupFocused
    ? 'var(--accent)'
    : 'var(--sep)'

  const groupGlow = isError
    ? '0 0 0 3.5px rgba(255, 59, 48, 0.14)'
    : isGroupFocused
    ? '0 0 0 3.5px rgba(0, 113, 227, 0.18)'
    : 'none'

  const btnContent = isLoading ? (
    <>
      <Spinner />
      <span>Verificando</span>
    </>
  ) : (
    'Iniciar sesión'
  )

  return (
    <div
      className="h-full overflow-y-auto no-scrollbar fade-in"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* ── Scrollable content area ─────────────────────────────────────── */}
      <div
        className="
          flex flex-col items-center
          min-h-full
          px-6 pt-12 pb-44
          md:justify-center md:px-0 md:py-14 md:pb-14
        "
      >
        {/* Card (on md+: white card; on mobile: flat content) */}
        <div className="login-card w-full md:w-[400px]">
          <form
            id="login-form"
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-5"
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col items-center text-center gap-3 mb-1">
              <Logo />
              <div>
                <h1
                  className="font-semibold"
                  style={{ fontSize: '28px', letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.15 }}
                >
                  Inicia sesión
                </h1>
                <p style={{ fontSize: '15px', color: 'var(--text-2)', marginTop: '5px', lineHeight: 1.4 }}>
                  Control de transporte de pollo BB
                </p>
              </div>
            </div>

            {/* ── Input group (iOS-style stacked) ────────────────────────── */}
            <div
              className="rounded-[10px] overflow-hidden"
              style={{
                border: `1px solid ${groupBorder}`,
                boxShadow: groupGlow,
                backgroundColor: 'var(--input-surface)',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              {/* Username */}
              <input
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                placeholder="Usuario"
                value={username}
                onChange={e => {
                  setUsername(e.target.value)
                  if (formState !== 'idle') resetForm()
                }}
                onFocus={() => setFocused('user')}
                onBlur={() => setFocused(null)}
                className="w-full bg-transparent outline-none px-4 field-h tabular-nums"
                style={{ fontSize: '15px', color: 'var(--text)', display: 'block' }}
                aria-label="Usuario"
              />

              {/* Separator */}
              <div
                style={{
                  height: '1px',
                  backgroundColor: 'var(--sep)',
                  marginLeft: '16px',
                }}
              />

              {/* Password */}
              <div className="flex items-center pr-3 pl-4">
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value)
                    if (formState !== 'idle') resetForm()
                  }}
                  onFocus={() => setFocused('pass')}
                  onBlur={() => setFocused(null)}
                  className="flex-1 bg-transparent outline-none field-h"
                  style={{ fontSize: '15px', color: 'var(--text)' }}
                  aria-label="Contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="flex items-center justify-center shrink-0 transition-opacity"
                  style={{
                    width: '36px',
                    height: '36px',
                    color: 'var(--text-2)',
                    opacity: showPass ? 1 : 0.7,
                  }}
                >
                  {showPass ? <IcEyeOff /> : <IcEyeOpen />}
                </button>
              </div>
            </div>

            {/* ── Error state ─────────────────────────────────────────────── */}
            {isError && (
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--c-red)',
                  marginTop: '-8px',
                  lineHeight: 1.4,
                }}
              >
                Usuario o contraseña incorrectos. Inténtalo de nuevo.
              </p>
            )}

            {/* ── Offline state ────────────────────────────────────────────── */}
            {isOffline && (
              <div
                className="rounded-[10px] p-4"
                style={{
                  border: '1px solid var(--sep)',
                  backgroundColor: 'var(--bg)',
                  marginTop: '-8px',
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="shrink-0"
                    style={{ color: 'var(--c-amber)', marginTop: '1px' }}
                  >
                    <IcWifiOff sz={18} />
                  </span>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                      Sin conexión
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '3px', lineHeight: 1.5 }}>
                      No se puede verificar la identidad sin señal. Comprueba tu conexión e inténtalo de nuevo.
                    </p>
                    <button
                      type="button"
                      onClick={resetForm}
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--accent)',
                        marginTop: '10px',
                      }}
                    >
                      Reintentar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Remember me ─────────────────────────────────────────────── */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none" style={{ marginTop: '-4px' }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="sr-only"
              />
              <div
                className="flex items-center justify-center shrink-0 rounded-[5px] transition-colors"
                aria-hidden="true"
                style={{
                  width: '18px',
                  height: '18px',
                  minWidth: '18px',
                  backgroundColor: remember ? 'var(--accent)' : 'transparent',
                  border: remember ? '1.5px solid var(--accent)' : '1.5px solid var(--sep)',
                  transition: 'background-color 0.15s, border-color 0.15s',
                }}
              >
                {remember && <Checkmark />}
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                Mantener la sesión iniciada
              </span>
            </label>

            {/* ── Primary button (desktop only — mobile is fixed below) ────── */}
            <button
              type="submit"
              disabled={isLoading}
              className="hidden md:flex w-full items-center justify-center gap-2 transition-opacity"
              style={{
                height: '48px',
                backgroundColor: 'var(--accent)',
                color: '#ffffff',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 500,
                opacity: isLoading ? 0.72 : 1,
              }}
            >
              {btnContent}
            </button>

            {/* ── Forgot password link ─────────────────────────────────────── */}
            <p className="text-center" style={{ marginTop: '-4px' }}>
              <button
                type="button"
                style={{ fontSize: '13px', color: 'var(--accent)' }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </p>
          </form>
        </div>

        {/* Version string — desktop, below card ───────────────────────────── */}
        <p
          className="hidden md:block mt-8 text-center"
          style={{ fontSize: '12px', color: 'var(--text-2)', letterSpacing: '0.01em' }}
        >
          admin / admin · monitor / monitor · superadmin → serial :8089
        </p>
      </div>

      {/* ── Mobile: button fixed at bottom (above virtual keyboard) ─────── */}
      <div
        className="fixed bottom-0 inset-x-0 flex flex-col md:hidden px-6 pt-6"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)',
          /* fade-out gradient so content behind looks natural */
          background: 'linear-gradient(to bottom, transparent 0%, var(--bg) 36%)',
        }}
      >
        <button
          type="submit"
          form="login-form"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 transition-opacity"
          style={{
            height: '52px',
            backgroundColor: 'var(--accent)',
            color: '#ffffff',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: 500,
            opacity: isLoading ? 0.72 : 1,
          }}
        >
          {btnContent}
        </button>

        <p
          className="text-center mt-4"
          style={{ fontSize: '12px', color: 'var(--text-2)', letterSpacing: '0.01em' }}
        >
          admin / admin · monitor / monitor · superadmin → serial :8089
        </p>
      </div>
    </div>
  )
}
