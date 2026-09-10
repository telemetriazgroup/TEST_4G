import { useState, useEffect } from "react";
import { applySetpoints, type LiveSnapshot } from "../api";

type Phase = "idle" | "sending";

interface Contactor {
  id: number;
  name: string;
  on: boolean;
  durationMin: number;
  phase: Phase;
  errorVisible: boolean;
}

const DEFAULTS: Omit<Contactor, "phase" | "errorVisible">[] = [
  { id: 1, name: "K1", on: true, durationMin: 42 },
  { id: 2, name: "K2", on: true, durationMin: 18 },
  { id: 3, name: "K3", on: false, durationMin: 5 },
  { id: 4, name: "K4", on: true, durationMin: 67 },
  { id: 5, name: "K5", on: false, durationMin: 120 },
  { id: 6, name: "K6", on: false, durationMin: 32 },
  { id: 7, name: "K7", on: true, durationMin: 11 },
  { id: 8, name: "K8", on: false, durationMin: 4 },
  { id: 9, name: "K9", on: false, durationMin: 88 },
  { id: 10, name: "K10", on: false, durationMin: 25 },
];

const INIT_TEMP = 24.0;
const INIT_HUM = 60;
const INIT_CO2 = 0.3;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2"
      style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-2)" }}
    >
      {children}
    </div>
  );
}

function Stepper({
  value, min, max, step, unit, rangeLabel, decimals, onChange,
}: {
  value: number; min: number; max: number; step: number;
  unit: string; rangeLabel: string; decimals: number;
  onChange: (v: number) => void;
}) {
  const fmt = (v: number) => decimals > 0 ? v.toFixed(decimals) : `${Math.round(v)}`;
  const adj = (dir: 1 | -1) => {
    const next = Math.round((value + dir * step) * 1e6) / 1e6;
    onChange(dir < 0 ? Math.max(min, next) : Math.min(max, next));
  };
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => adj(-1)}
          disabled={value <= min}
          className="flex items-center justify-center rounded-full select-none font-bold disabled:opacity-30"
          style={{ width: 32, height: 32, minHeight: 44, backgroundColor: "var(--nav-pill)", color: "var(--text)", fontSize: 20, flexShrink: 0 }}
          aria-label="Disminuir"
        >−</button>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            value={fmt(value)}
            min={min}
            max={max}
            step={step}
            onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v))); }}
            className="text-center font-semibold rounded-lg border"
            style={{ width: 56, height: 36, borderColor: "var(--sep)", backgroundColor: "var(--surface)", color: "var(--text)", fontSize: 15 }}
          />
          <span className="font-medium" style={{ fontSize: 14, color: "var(--text-2)", minWidth: 24 }}>{unit}</span>
        </div>
        <button
          onClick={() => adj(1)}
          disabled={value >= max}
          className="flex items-center justify-center rounded-full select-none font-bold disabled:opacity-30"
          style={{ width: 32, height: 32, minHeight: 44, backgroundColor: "var(--nav-pill)", color: "var(--text)", fontSize: 20, flexShrink: 0 }}
          aria-label="Aumentar"
        >+</button>
      </div>
      <span style={{ fontSize: 12, color: "var(--text-2)" }}>{rangeLabel}</span>
    </div>
  );
}

function IOSSwitch({ on, pending, onClick }: { on: boolean; pending: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: 51, height: 31, borderRadius: 31, padding: 0, border: "none", flexShrink: 0,
        backgroundColor: on ? "var(--c-green)" : "var(--sep)",
        position: "relative", transition: "background-color 0.18s",
        opacity: pending ? 0.5 : 1, cursor: "pointer",
      }}
    >
      {pending
        ? <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 16, height: 16, borderRadius: "50%", display: "block", border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "white", animation: "spin 0.7s linear infinite" }} />
        : <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: "50%", display: "block", backgroundColor: "white", boxShadow: "0 2px 4px rgba(0,0,0,0.25)", transition: "left 0.18s" }} />
      }
    </button>
  );
}

function ConfirmSheet({ name, toOn, onCancel, onConfirm }: {
  name: string; toOn: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const action = toOn ? "Encender" : "Apagar";
  const title = `¿${action} Contactor ${name}?`;
  const body = "Esta acción actúa sobre el equipo de forma inmediata.";

  const Btns = () => (
    <div className="flex gap-2">
      <button
        onClick={onCancel}
        className="flex-1 rounded-xl font-semibold text-sm min-h-[44px]"
        style={{ backgroundColor: "var(--nav-pill)", color: "var(--text)" }}
      >Cancelar</button>
      <button
        onClick={onConfirm}
        className="flex-1 rounded-xl font-semibold text-sm min-h-[44px] text-white"
        style={{ backgroundColor: "var(--accent)" }}
      >{action}</button>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onCancel} />
      <div className="fixed inset-0 z-50 pointer-events-none">
        <div className="hidden md:flex items-center justify-center h-full">
          <div
            className="pointer-events-auto w-full max-w-sm mx-4 rounded-2xl p-6"
            style={{ backgroundColor: "var(--surface)", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
          >
            <p className="font-semibold text-[17px] mb-2" style={{ color: "var(--text)" }}>{title}</p>
            <p className="text-sm mb-5" style={{ color: "var(--text-2)" }}>{body}</p>
            <Btns />
          </div>
        </div>
        <div
          className="md:hidden fixed bottom-0 left-0 right-0 pointer-events-auto rounded-t-[20px] p-5"
          style={{ backgroundColor: "var(--surface)", boxShadow: "0 -4px 24px rgba(0,0,0,0.12)" }}
        >
          <p className="font-semibold text-[17px] mb-2" style={{ color: "var(--text)" }}>{title}</p>
          <p className="text-sm mb-5" style={{ color: "var(--text-2)" }}>{body}</p>
          <Btns />
          <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
        </div>
      </div>
    </>
  );
}

export default function Configuracion({ live }: { live: LiveSnapshot | null }) {
  const [temp, setTemp] = useState(live?.setpoint_c ?? INIT_TEMP);
  const [hum, setHum] = useState(live?.humidity_setpoint_pct ?? INIT_HUM);
  const [co2, setCo2] = useState(live?.co2_setpoint_pct ?? INIT_CO2);
  const [applied, setApplied] = useState({
    temp: live?.setpoint_c ?? INIT_TEMP,
    hum: live?.humidity_setpoint_pct ?? INIT_HUM,
    co2: live?.co2_setpoint_pct ?? INIT_CO2,
  });
  const [synced, setSynced] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!live || synced) return;
    const t = live.setpoint_c ?? INIT_TEMP;
    const h = live.humidity_setpoint_pct ?? INIT_HUM;
    const c = live.co2_setpoint_pct ?? INIT_CO2;
    setTemp(t);
    setHum(h);
    setCo2(c);
    setApplied({ temp: t, hum: h, co2: c });
    setSynced(true);
  }, [live, synced]);

  const near = (a: number, b: number, d = 0.05) => Math.abs(a - b) < d;
  const changes = [!near(temp, applied.temp), !near(hum, applied.hum, 0.5), !near(co2, applied.co2, 0.05)].filter(Boolean).length;

  const handleApply = async () => {
    setSending(true);
    setError("");
    try {
      await applySetpoints({
        ident: live?.ident || "POLLO_BEBE",
        temperature_c: temp,
        humidity_pct: hum,
        co2_pct: co2,
      });
      setApplied({ temp, hum, co2 });
      setApplyFeedback(true);
      setTimeout(() => setApplyFeedback(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const handleDiscard = () => {
    setTemp(applied.temp);
    setHum(applied.hum);
    setCo2(applied.co2);
    setError("");
  };

  const relays = live?.relays || [];

  const ROWS = [
    {
      label: "Temperatura", value: temp, set: setTemp,
      min: 18, max: 32, step: 0.1, unit: "°C", range: "18–32 °C", decimals: 1,
      hint: "Rango recomendado para pollo BB: 23–25 °C",
    },
    {
      label: "Humedad", value: hum, set: setHum,
      min: 20, max: 90, step: 1, unit: "%", range: "20–90 %", decimals: 0,
      hint: null,
    },
    {
      label: "CO₂", value: co2, set: setCo2,
      min: 0, max: 5, step: 0.1, unit: "%", range: "0–5 %", decimals: 1,
      hint: "Misma unidad que la cámara (porcentaje)",
    },
  ];

  return (
    <div
      style={{ backgroundColor: "var(--bg)", minHeight: "100vh" }}
      className={changes > 0 ? "pb-[120px] md:pb-[88px]" : "pb-4"}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="max-w-[900px] mx-auto px-4 pt-4">

        <SectionLabel>Consignas</SectionLabel>
        <div
          className="rounded-[14px] border"
          style={{ backgroundColor: "var(--surface)", boxShadow: "var(--shadow)", borderColor: "var(--sep)" }}
        >
          {ROWS.map((row, i) => (
            <div
              key={row.label}
              className="px-4 md:px-5 py-3"
              style={{ borderBottom: i < ROWS.length - 1 ? "1px solid var(--sep)" : undefined }}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-medium text-[15px]" style={{ color: "var(--text)" }}>{row.label}</div>
                  {row.hint && (
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{row.hint}</div>
                  )}
                </div>
                <Stepper
                  value={row.value}
                  min={row.min}
                  max={row.max}
                  step={row.step}
                  unit={row.unit}
                  rangeLabel={row.range}
                  decimals={row.decimals}
                  onChange={row.set}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 mb-2">
          <SectionLabel>Estado de relés (solo lectura)</SectionLabel>
          <p className="text-xs mb-2" style={{ color: "var(--text-2)" }}>
            Referencia de la cámara. El accionamiento está en el monitor de superadmin.
          </p>
        </div>

        <div
          className="rounded-[14px] border"
          style={{ backgroundColor: "var(--surface)", boxShadow: "var(--shadow)", borderColor: "var(--sep)" }}
        >
          {(relays.length ? relays : []).map((c, i) => (
            <div key={c.id} style={{ borderBottom: i < relays.length - 1 ? "1px solid var(--sep)" : undefined }}>
              <div className="flex items-center gap-3 px-4 md:px-5 min-h-[48px] py-2">
                <span className="font-medium text-[15px]" style={{ color: "var(--text)" }}>{c.name}</span>
                <div className="flex-1" />
                <span style={{ fontSize: 13, fontWeight: 600, color: c.on ? "var(--c-green)" : "var(--text-2)" }}>
                  {c.on == null ? "—" : c.on ? "ON" : "OFF"}
                </span>
              </div>
            </div>
          ))}
          {!relays.length && (
            <p className="px-4 py-3 text-sm" style={{ color: "var(--text-2)" }}>Sin lectura de relés todavía.</p>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm" style={{ color: "var(--c-red)" }}>{error}</p>
        )}

      </div>

      {changes > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 confirm-bar"
          style={{
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            backgroundColor: "var(--surface-blur)",
            borderTop: "1px solid var(--sep)",
          }}
        >
          <div className="max-w-[900px] mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center gap-2">
            <span className="text-[13px]" style={{ color: "var(--text-2)" }}>
              {changes === 1 ? "1 cambio sin guardar" : `${changes} cambios sin guardar`}
            </span>
            <div className="flex gap-2 md:ml-auto">
              <button
                onClick={handleDiscard}
                className="flex-1 md:flex-none rounded-xl font-semibold text-sm min-h-[44px] px-4"
                style={{ backgroundColor: "var(--nav-pill)", color: "var(--text)" }}
              >Descartar</button>
              <button
                onClick={handleApply}
                className="flex-1 md:flex-none rounded-xl font-semibold text-sm min-h-[44px] px-4 text-white"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {sending ? "Encolando…" : applyFeedback ? "En cola / enviado" : "Aplicar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
