import { useState, useEffect, useMemo, useRef } from "react";
import { fetchSeries, type SeriesPoint } from "../api";

type DataPoint = {
  ts: number;
  iso?: string;
  supply: number;
  return_: number;
  setpoint: number;
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  humidity: number;
  co2: number;
  ventilation: number;
};

type SeriesInfo = {
  key: string;
  label: string;
  color: string;
  axis: "left" | "right";
  dashed?: boolean;
};

const SERIES: SeriesInfo[] = [
  { key: "supply", label: "Suministro", color: "#4A7ACC", axis: "left" },
  { key: "return_", label: "Retorno", color: "#3A9B8E", axis: "left" },
  { key: "setpoint", label: "Setpoint", color: "#9B9BA8", axis: "left", dashed: true },
  { key: "z1", label: "Zona 1", color: "#7B5EA7", axis: "left" },
  { key: "z2", label: "Zona 2", color: "#6B7FA0", axis: "left" },
  { key: "z3", label: "Zona 3", color: "#C07030", axis: "left" },
  { key: "z4", label: "Zona 4", color: "#6B8040", axis: "left" },
  { key: "humidity", label: "Humedad", color: "#5A8A9F", axis: "right" },
  { key: "co2", label: "CO₂", color: "#8B5E3B", axis: "right" },
  { key: "ventilation", label: "Ventilación", color: "#5A8065", axis: "right" },
];

function seriesToPoints(rows: SeriesPoint[], rangeStart: Date): DataPoint[] {
  return rows
    .map((p) => {
      const t = new Date(p.ts);
      const ts = Math.round((t.getTime() - rangeStart.getTime()) / 60000);
      return {
        ts,
        iso: p.ts,
        supply: p.supply_air_c ?? 0,
        return_: p.return_air_c ?? 0,
        setpoint: p.setpoint_c ?? 0,
        z1: p.usda1_c ?? 0,
        z2: p.usda2_c ?? 0,
        z3: p.usda3_c ?? 0,
        z4: p.usda4_c ?? 0,
        humidity: p.humidity_pct ?? 0,
        co2: p.co2_pct ?? 0,
        ventilation: 0,
      };
    })
    .filter((d) => Number.isFinite(d.ts));
}

function fmtTs(ts: number): string {
  const h = Math.floor(ts / 60) % 24;
  const m = Math.abs(ts % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtPointTime(d: DataPoint): string {
  if (d.iso) {
    const t = new Date(d.iso);
    if (!Number.isNaN(t.getTime())) {
      return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    }
  }
  return fmtTs(d.ts);
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDTStr(d: Date): string {
  return `${toDateStr(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type ChartProps = {
  data: DataPoint[];
  activeSeries: Set<string>;
  xMin: number;
  xMax: number;
  onZoom: (a: number, b: number) => void;
  isZoomed: boolean;
  onResetZoom: () => void;
  isMobile: boolean;
};

function SVGChart({ data, activeSeries, xMin, xMax, onZoom, isZoomed, onResetZoom, isMobile }: ChartProps) {
  const cRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(600);
  const [fs, setFs] = useState(false);
  const ch = isMobile ? 260 : 380;

  useEffect(() => {
    const obs = new ResizeObserver((es) => {
      const w = es[0]?.contentRect.width;
      if (w) setCw(Math.floor(w));
    });
    if (cRef.current) obs.observe(cRef.current);
    return () => obs.disconnect();
  }, [fs]);

  const [tip, setTip] = useState<{ x: number; y: number; pt: DataPoint } | null>(null);
  const drag = useRef<{ sx: number; sts: number; cx: number; on: boolean } | null>(null);
  const [dprev, setDprev] = useState<{ x1: number; x2: number } | null>(null);

  const PL = 48, PR = 48, PT = 12, PB = 30;
  const iW = cw - PL - PR;
  const iH = ch - PT - PB;

  const scX = (ts: number) => PL + ((ts - xMin) / (xMax - xMin || 1)) * iW;
  const scYL = (v: number) => PT + (1 - (v - 19) / 11) * iH;
  const scYR = (v: number) => PT + (1 - v / 100) * iH;

  const filt = useMemo(() => data.filter((d) => d.ts >= xMin && d.ts <= xMax), [data, xMin, xMax]);

  const getV = (d: DataPoint, k: string): number => {
    if (k === "co2") return d.co2 * 20;
    return (d as unknown as Record<string, number>)[k];
  };

  const scY = (k: string) => (SERIES.find((s) => s.key === k)?.axis === "right" ? scYR : scYL);

  const polyPts = (k: string) =>
    filt.map((d) => `${scX(d.ts).toFixed(1)},${scY(k)(getV(d, k)).toFixed(1)}`).join(" ");

  const onMv = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isMobile) return;
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    if (drag.current) {
      if (Math.abs(mx - drag.current.sx) > 20) drag.current.on = true;
      drag.current.cx = mx;
      if (drag.current.on) {
        setDprev({ x1: Math.min(drag.current.sx, mx), x2: Math.max(drag.current.sx, mx) });
        setTip(null);
      }
      return;
    }
    if (!filt.length) return;
    const ts = xMin + ((mx - PL) / iW) * (xMax - xMin);
    const pt = filt.reduce((p, c) => (Math.abs(c.ts - ts) < Math.abs(p.ts - ts) ? c : p));
    setTip({ x: scX(pt.ts), y: e.clientY - r.top, pt });
  };

  const onLv = () => {
    setTip(null);
    drag.current = null;
    setDprev(null);
  };

  const onDn = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isMobile) return;
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const ts = xMin + ((mx - PL) / iW) * (xMax - xMin);
    drag.current = { sx: mx, sts: ts, cx: mx, on: false };
    setTip(null);
  };

  const onUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isMobile || !drag.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    if (drag.current.on && Math.abs(mx - drag.current.sx) > 20) {
      const ets = xMin + ((mx - PL) / iW) * (xMax - xMin);
      const a = Math.max(0, Math.min(drag.current.sts, ets));
      const b = Math.min(1440, Math.max(drag.current.sts, ets));
      if (b - a > 10) onZoom(a, b);
    }
    drag.current = null;
    setDprev(null);
  };

  const yVals = [19, 22, 24, 27, 30];
  const rVals = [0, 25, 50, 75, 100];
  const nTk = 6;
  const tkStep = (xMax - xMin) / nTk;
  const ax1 = Math.max(PL, scX(180));
  const ax2 = Math.min(cw - PR, scX(240));

  const svgEl = (
    <svg
      width={cw}
      height={ch}
      style={{ display: "block", userSelect: "none", cursor: isMobile ? "default" : "crosshair" }}
      onMouseMove={onMv}
      onMouseLeave={onLv}
      onMouseDown={onDn}
      onMouseUp={onUp}
    >
      <defs>
        <clipPath id="hChartClip">
          <rect x={PL} y={PT} width={iW} height={iH} />
        </clipPath>
      </defs>

      {yVals.map((v) => (
        <line key={v} x1={PL} y1={scYL(v)} x2={cw - PR} y2={scYL(v)} stroke="rgba(0,0,0,0.07)" strokeWidth={1} />
      ))}

      {Array.from({ length: nTk + 1 }, (_, i) => {
        const ts = xMin + i * tkStep;
        const x = scX(ts);
        const label = fmtTs(Math.max(0, Math.round(ts / 5) * 5));
        return (
          <g key={i}>
            <line x1={x} y1={PT} x2={x} y2={ch - PB} stroke="rgba(0,0,0,0.07)" strokeWidth={1} />
            <text x={x} y={ch - PB + 14} textAnchor="middle" fontSize={9} fill="var(--text-2)">
              {label}
            </text>
          </g>
        );
      })}

      {ax1 < ax2 && (
        <rect x={ax1} y={PT} width={ax2 - ax1} height={iH} fill="rgba(255,59,48,0.07)" />
      )}

      {yVals.map((v) => (
        <text key={v} x={PL - 6} y={scYL(v) + 4} textAnchor="end" fontSize={10} fill="var(--text-2)">
          {v}
        </text>
      ))}
      {rVals.map((v) => (
        <text key={v} x={cw - PR + 6} y={scYR(v) + 4} textAnchor="start" fontSize={10} fill="var(--text-2)">
          {v}
        </text>
      ))}
      <text x={PL - 6} y={PT - 2} textAnchor="end" fontSize={9} fill="var(--text-2)">°C</text>
      <text x={cw - PR + 6} y={PT - 2} textAnchor="start" fontSize={9} fill="var(--text-2)">%</text>

      <g clipPath="url(#hChartClip)">
        {SERIES.filter((s) => activeSeries.has(s.key)).map((s) => (
          <polyline
            key={s.key}
            points={polyPts(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.dashed ? 1.5 : 2}
            strokeDasharray={s.dashed ? "4,3" : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </g>

      {tip && (
        <line
          x1={tip.x} y1={PT} x2={tip.x} y2={ch - PB}
          stroke="rgba(0,0,0,0.25)" strokeWidth={1} strokeDasharray="3,3"
        />
      )}

      {dprev && (
        <rect
          x={dprev.x1} y={PT} width={dprev.x2 - dprev.x1} height={iH}
          fill="rgba(0,113,227,0.1)" stroke="rgba(0,113,227,0.3)" strokeWidth={1}
        />
      )}
    </svg>
  );

  const tipEl = tip && !dprev ? (
    <div style={{
      position: "absolute",
      left: tip.x + 14 > cw - 160 ? tip.x - 162 : tip.x + 14,
      top: Math.max(0, tip.y - 80),
      background: "var(--surface)",
      border: "1px solid var(--sep)",
      borderRadius: 10,
      padding: "8px 12px",
      boxShadow: "var(--shadow)",
      zIndex: 20,
      pointerEvents: "none",
      minWidth: 152,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
        {fmtPointTime(tip.pt)}
      </div>
      {SERIES.filter((s) => activeSeries.has(s.key)).map((s) => {
        const raw = (tip.pt as unknown as Record<string, number>)[s.key];
        const dv =
          s.key === "co2"
            ? raw.toFixed(1) + " %"
            : s.axis === "right"
            ? raw.toFixed(1) + "%"
            : raw.toFixed(1) + "°C";
        return (
          <div key={s.key} style={{ display: "flex", gap: 6, fontSize: 11, marginBottom: 2, alignItems: "center" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0, display: "inline-block" }} />
            <span style={{ flex: 1, color: "var(--text-2)" }}>{s.label}</span>
            <span style={{ fontWeight: 500, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{dv}</span>
          </div>
        );
      })}
    </div>
  ) : null;

  if (fs) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--sep)", background: "var(--surface)" }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>Gráfica histórica</span>
          <button
            onClick={() => setFs(false)}
            style={{ background: "none", border: "none", fontSize: 22, color: "var(--text)", cursor: "pointer", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "6px 12px", fontSize: 11, color: "var(--text-2)", background: "var(--surface)", borderBottom: "1px solid var(--sep)" }}>
          Gira el dispositivo a horizontal para mejor visualización
        </div>
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }} ref={cRef}>
          {svgEl}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, minHeight: 36 }}>
        <div>
          {isZoomed && !isMobile && (
            <button
              onClick={onResetZoom}
              style={{ background: "var(--surface)", border: "1px solid var(--sep)", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "var(--accent)", cursor: "pointer" }}
            >
              Restablecer zoom
            </button>
          )}
        </div>
        {isMobile && (
          <button
            onClick={() => setFs(true)}
            style={{ background: "none", border: "1px solid var(--sep)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--text-2)", cursor: "pointer", minHeight: 44 }}
          >
            Ver a pantalla completa
          </button>
        )}
      </div>
      <div ref={cRef} style={{ position: "relative" }}>
        {svgEl}
        {tipEl}
      </div>
    </div>
  );
}

export default function Historico({ ident = "POLLO_BEBE" }: { ident?: string }) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayRef = useMemo(() => new Date(), []);

  const endDate = useMemo(() => new Date(baseDate.getTime() + 24 * 3600 * 1000), [baseDate]);

  const [mob, setMob] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const h = () => setMob(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const [toast, setToast] = useState<string | null>(null);
  const [genning, setGenning] = useState(false);

  const [rStart, setRStart] = useState(() => toDateStr(baseDate));
  const [rEnd, setREnd] = useState(() => toDateStr(todayRef));
  const [rFmt, setRFmt] = useState<"PDF" | "CSV">("PDF");

  const [acts, setActs] = useState<Set<string>>(() =>
    new Set(window.innerWidth < 768 ? ["supply", "return_", "setpoint"] : ["supply", "return_", "setpoint", "z3"])
  );

  const [xMin, setXMin] = useState(0);
  const [xMax, setXMax] = useState(1440);
  const [zoomed, setZoomed] = useState(false);

  const [csStart, setCsStart] = useState(() => toDTStr(baseDate));
  const [csEnd, setCsEnd] = useState(() => toDTStr(endDate));

  const [tInt, setTInt] = useState("5");
  const [tSrch, setTSrch] = useState("");
  const [tPage, setTPage] = useState(0);
  const [selRow, setSelRow] = useState<DataPoint | null>(null);

  useEffect(() => {
    const start = new Date(`${rStart}T00:00:00`);
    const end = new Date(`${rEnd}T23:59:59`);
    const hours = Math.min(168, Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 3600000)));
    let cancel = false;
    setLoading(true);
    fetchSeries(hours, ident)
      .then((rows) => {
        if (cancel) return;
        const pts = seriesToPoints(rows, start).filter((d) => {
          if (!d.iso) return d.ts >= 0;
          const t = new Date(d.iso).getTime();
          return t >= start.getTime() && t <= end.getTime();
        });
        setData(pts);
        if (pts.length) {
          setXMin(pts[0].ts);
          setXMax(pts[pts.length - 1].ts);
        } else {
          setXMin(0);
          setXMax(Math.max(60, hours * 60));
        }
        setZoomed(false);
      })
      .catch(() => {
        if (!cancel) setData([]);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [rStart, rEnd, ident]);

  const PG = 50;

  const toggle = (k: string) => {
    setActs((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };

  const doGen = () => {
    setGenning(true);
    setTimeout(() => {
      setGenning(false);
      setToast("Reporte generado");
      setTimeout(() => setToast(null), 3000);
    }, 1500);
  };

  const resetZoom = () => {
    setXMin(0);
    setXMax(1440);
    setZoomed(false);
    setCsStart(toDTStr(baseDate));
    setCsEnd(toDTStr(endDate));
  };

  const onCsS = (v: string) => {
    setCsStart(v);
    const ms = new Date(v).getTime() - baseDate.getTime();
    const nm = Math.max(0, Math.min(1440, ms / 60000));
    setXMin(nm);
    setZoomed(nm > 0 || xMax < 1440);
  };

  const onCsE = (v: string) => {
    setCsEnd(v);
    const ms = new Date(v).getTime() - baseDate.getTime();
    const nm = Math.max(0, Math.min(1440, ms / 60000));
    setXMax(nm);
    setZoomed(xMin > 0 || nm < 1440);
  };

  const onZoom = (a: number, b: number) => {
    setXMin(a);
    setXMax(b);
    setZoomed(true);
    setCsStart(toDTStr(new Date(baseDate.getTime() + a * 60000)));
    setCsEnd(toDTStr(new Date(baseDate.getTime() + b * 60000)));
  };

  const applyChip = (label: string) => {
    const tod = new Date();
    tod.setHours(0, 0, 0, 0);
    const yes = new Date(tod);
    yes.setDate(yes.getDate() - 1);
    if (label === "Hoy") {
      setRStart(toDateStr(tod));
      setREnd(toDateStr(tod));
    } else if (label === "Ayer") {
      setRStart(toDateStr(yes));
      setREnd(toDateStr(yes));
    } else if (label === "Últimos 7 días") {
      const w = new Date(tod);
      w.setDate(w.getDate() - 7);
      setRStart(toDateStr(w));
      setREnd(toDateStr(tod));
    } else {
      setRStart(toDateStr(yes));
      setREnd(toDateStr(tod));
    }
    resetZoom();
  };

  const tData = useMemo(() => {
    const stepMin = Math.max(1, parseInt(tInt, 10) || 5);
    let last = -Infinity;
    return data.filter((d) => {
      if (d.ts < xMin || d.ts > xMax) return false;
      if (d.ts - last < stepMin) return false;
      last = d.ts;
      const q = tSrch.toLowerCase().trim();
      return q === "" || fmtPointTime(d).includes(q);
    });
  }, [data, xMin, xMax, tInt, tSrch]);

  useEffect(() => {
    setTPage(0);
  }, [tSrch, tInt, xMin, xMax]);

  const totPg = Math.ceil(tData.length / PG);
  const pgDat = tData.slice(tPage * PG, (tPage + 1) * PG);

  const cc = (d: DataPoint, k: string): string | undefined => {
    if (["z1", "z2", "z3", "z4"].includes(k)) {
      const v = (d as unknown as Record<string, number>)[k];
      if (v > d.setpoint + 1.5) return "var(--c-red)";
      if (v > d.setpoint + 0.8) return "var(--c-amber)";
    }
    if (k === "co2") {
      if (d.co2 > 1.5) return "var(--c-red)";
      if (d.co2 > 0.8) return "var(--c-amber)";
    }
    return undefined;
  };

  const chips = ["Viaje actual", "Hoy", "Ayer", "Últimos 7 días"];

  const inpBase: React.CSSProperties = {
    background: "var(--bg)",
    border: "1px solid var(--sep)",
    borderRadius: 8,
    padding: "0 10px",
    color: "var(--text)",
    outline: "none",
  };

  const pillBtn: React.CSSProperties = {
    background: "var(--nav-pill)",
    color: "var(--text)",
    border: "none",
    borderRadius: 20,
    padding: "8px 14px",
    fontSize: 13,
    cursor: "pointer",
    minHeight: 44,
    whiteSpace: "nowrap",
  };

  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--sep)",
    borderRadius: 14,
    boxShadow: "var(--shadow)",
    padding: 16,
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)", fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {toast && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          zIndex: 100, background: "var(--c-green)", color: "#fff", borderRadius: 10,
          padding: "10px 20px", fontWeight: 600, fontSize: 14,
          boxShadow: "var(--shadow)", pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: mob ? "16px 12px" : "24px 24px" }}>
        <h1 style={{ fontSize: mob ? 20 : 24, fontWeight: 700, marginBottom: 20, color: "var(--text)" }}>
          Histórico
        </h1>
        {loading && (
          <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: -12, marginBottom: 16 }}>
            Cargando serie de {ident}…
          </p>
        )}

        <div style={{ ...card, marginBottom: 20 }}>
          {mob ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 4 }}>Desde</div>
                  <input
                    type="date"
                    value={rStart}
                    onChange={(e) => setRStart(e.target.value)}
                    style={{ ...inpBase, height: 44, fontSize: 14, width: "100%", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 4 }}>Hasta</div>
                  <input
                    type="date"
                    value={rEnd}
                    onChange={(e) => setREnd(e.target.value)}
                    style={{ ...inpBase, height: 44, fontSize: 14, width: "100%", boxSizing: "border-box" }}
                  />
                </div>
              </div>
              <select
                value={rFmt}
                onChange={(e) => setRFmt(e.target.value as "PDF" | "CSV")}
                style={{ ...inpBase, height: 44, fontSize: 14, width: "100%" }}
              >
                <option value="PDF">PDF</option>
                <option value="CSV">CSV</option>
              </select>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
                {chips.map((c) => (
                  <button key={c} onClick={() => applyChip(c)} style={pillBtn}>{c}</button>
                ))}
              </div>
              <button
                onClick={doGen}
                disabled={genning}
                style={{
                  background: genning ? "var(--c-gray)" : "var(--accent)",
                  color: "#fff", border: "none", borderRadius: 10, height: 44,
                  fontSize: 15, fontWeight: 600, cursor: genning ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {genning && (
                  <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                )}
                Generar reporte
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 4 }}>Desde</div>
                <input
                  type="date"
                  value={rStart}
                  onChange={(e) => setRStart(e.target.value)}
                  style={{ ...inpBase, height: 44, fontSize: 14 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 4 }}>Hasta</div>
                <input
                  type="date"
                  value={rEnd}
                  onChange={(e) => setREnd(e.target.value)}
                  style={{ ...inpBase, height: 44, fontSize: 14 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 4 }}>Formato</div>
                <select
                  value={rFmt}
                  onChange={(e) => setRFmt(e.target.value as "PDF" | "CSV")}
                  style={{ ...inpBase, height: 44, fontSize: 14 }}
                >
                  <option value="PDF">PDF</option>
                  <option value="CSV">CSV</option>
                </select>
              </div>
              <button
                onClick={doGen}
                disabled={genning}
                style={{
                  background: genning ? "var(--c-gray)" : "var(--accent)",
                  color: "#fff", border: "none", borderRadius: 10, height: 44,
                  fontSize: 14, fontWeight: 600, cursor: genning ? "not-allowed" : "pointer",
                  minWidth: 160, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {genning && (
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                )}
                Generar reporte
              </button>
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {chips.map((c) => (
                  <button key={c} onClick={() => applyChip(c)} style={pillBtn}>{c}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-2)" }}>
            Último reporte generado: 30/08/2026, 18:24 · PDF ·{" "}
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{ color: "var(--accent)", textDecoration: "none" }}
            >
              Descargar de nuevo
            </a>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-2)" }}>
            El reporte incluirá el resumen de alarmas del período.
          </div>
        </div>

        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: mob ? "column" : "row", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: mob ? "flex-start" : "center" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 3 }}>Inicio</div>
                <input
                  type="datetime-local"
                  value={csStart}
                  onChange={(e) => onCsS(e.target.value)}
                  style={{ ...inpBase, height: 40, fontSize: 12, minWidth: 160, padding: "0 8px" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 3 }}>Fin</div>
                <input
                  type="datetime-local"
                  value={csEnd}
                  onChange={(e) => onCsE(e.target.value)}
                  style={{ ...inpBase, height: 40, fontSize: 12, minWidth: 160, padding: "0 8px" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", flexWrap: mob ? "nowrap" : "wrap", paddingBottom: mob ? 4 : 0 }}>
              {SERIES.map((s) => {
                const active = acts.has(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => toggle(s.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      background: active ? "var(--surface)" : "var(--bg)",
                      border: `1px solid ${active ? s.color : "var(--sep)"}`,
                      borderRadius: 20, padding: "5px 11px", fontSize: 12,
                      color: active ? "var(--text)" : "var(--text-2)",
                      cursor: "pointer", minHeight: 36, whiteSpace: "nowrap",
                      opacity: active ? 1 : 0.55,
                    }}
                  >
                    {active && (
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0, display: "inline-block" }} />
                    )}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <SVGChart
            data={data}
            activeSeries={acts}
            xMin={xMin}
            xMax={xMax}
            onZoom={onZoom}
            isZoomed={zoomed}
            onResetZoom={resetZoom}
            isMobile={mob}
          />
        </div>

        <div style={card}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, color: "var(--text-2)", whiteSpace: "nowrap" }}>Intervalo:</span>
              <select
                value={tInt}
                onChange={(e) => setTInt(e.target.value)}
                style={{ ...inpBase, height: 44, fontSize: 13, minWidth: 80, padding: "0 8px" }}
              >
                <option value="1">1 min</option>
                <option value="5">5 min</option>
                <option value="15">15 min</option>
                <option value="60">1 h</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
              <span style={{ color: "var(--text-2)" }}>Total:</span>
              <span style={{ fontWeight: 500 }}>{tData.length}</span>
            </div>
            <input
              type="text"
              placeholder="Buscar..."
              value={tSrch}
              onChange={(e) => setTSrch(e.target.value)}
              style={{ ...inpBase, height: 44, fontSize: 13, flex: 1, minWidth: 120 }}
            />
            <button
              onClick={() => {
                const hdr = "Hora,Suministro,Retorno,Setpoint,Z1,Z2,Z3,Z4,Humedad,CO2,Ventilacion\n";
                const rows = tData
                  .map((d) =>
                    `${fmtPointTime(d)},${d.supply.toFixed(1)},${d.return_.toFixed(1)},${d.setpoint.toFixed(1)},${d.z1.toFixed(1)},${d.z2.toFixed(1)},${d.z3.toFixed(1)},${d.z4.toFixed(1)},${d.humidity.toFixed(1)},${d.co2.toFixed(1)},${d.ventilation.toFixed(1)}`
                  )
                  .join("\n");
                const blob = new Blob([hdr + rows], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "historico.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{
                background: "none", border: "1px solid var(--sep)", borderRadius: 8,
                padding: "0 14px", height: 44, fontSize: 13, color: "var(--text)",
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Exportar CSV
            </button>
          </div>

          {tData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 15, color: "var(--text-2)", marginBottom: 12 }}>No hay datos en este rango</div>
              <button
                onClick={resetZoom}
                style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", height: 44, fontSize: 13, cursor: "pointer" }}
              >
                Ampliar rango
              </button>
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Fecha y hora", "Suministro", "Retorno", "Setpoint", "Z1", "Z2", "Z3", "Z4", "Humedad", "CO₂", "Ventil."].map((h, i) => (
                        <th
                          key={h}
                          style={{
                            position: "sticky",
                            top: 0,
                            ...(i === 0 && mob ? { left: 0 } : {}),
                            background: "var(--surface)",
                            zIndex: i === 0 && mob ? 3 : 2,
                            padding: "8px 10px",
                            textAlign: i === 0 ? "left" : "right",
                            fontWeight: 600,
                            fontSize: 12,
                            color: "var(--text-2)",
                            borderBottom: "1px solid var(--sep)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pgDat.map((d) => {
                      const cells: { k: string; val: string }[] = [
                        { k: "ts", val: fmtPointTime(d) },
                        { k: "supply", val: d.supply.toFixed(1) + "°C" },
                        { k: "return_", val: d.return_.toFixed(1) + "°C" },
                        { k: "setpoint", val: d.setpoint.toFixed(1) + "°C" },
                        { k: "z1", val: d.z1.toFixed(1) + "°C" },
                        { k: "z2", val: d.z2.toFixed(1) + "°C" },
                        { k: "z3", val: d.z3.toFixed(1) + "°C" },
                        { k: "z4", val: d.z4.toFixed(1) + "°C" },
                        { k: "humidity", val: d.humidity.toFixed(1) + "%" },
                        { k: "co2", val: d.co2.toFixed(1) + "%" },
                        { k: "ventilation", val: d.ventilation.toFixed(1) + "%" },
                      ];
                      return (
                        <tr
                          key={d.ts}
                          onClick={() => mob && setSelRow(d)}
                          style={{ cursor: mob ? "pointer" : "default" }}
                        >
                          {cells.map((c, ci) => (
                            <td
                              key={c.k}
                              style={{
                                padding: "7px 10px",
                                textAlign: ci === 0 ? "left" : "right",
                                borderBottom: "1px solid var(--sep)",
                                fontVariantNumeric: "tabular-nums",
                                color: ci === 0 ? "var(--text)" : (cc(d, c.k) ?? "var(--text)"),
                                fontWeight: cc(d, c.k) ? 600 : 400,
                                whiteSpace: "nowrap",
                                ...(ci === 0 && mob
                                  ? ({ position: "sticky", left: 0, background: "var(--surface)", zIndex: 1 } as React.CSSProperties)
                                  : {}),
                              }}
                            >
                              {c.val}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                <button
                  onClick={() => setTPage((p) => Math.max(0, p - 1))}
                  disabled={tPage === 0}
                  style={{
                    background: "var(--nav-pill)", border: "none", borderRadius: 8,
                    padding: "0 16px", height: 44, fontSize: 13,
                    cursor: tPage === 0 ? "not-allowed" : "pointer",
                    color: "var(--text)", opacity: tPage === 0 ? 0.4 : 1,
                  }}
                >
                  ← Anterior
                </button>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                  {tPage + 1} / {Math.max(1, totPg)}
                </span>
                <button
                  onClick={() => setTPage((p) => Math.min(totPg - 1, p + 1))}
                  disabled={tPage >= totPg - 1}
                  style={{
                    background: "var(--nav-pill)", border: "none", borderRadius: 8,
                    padding: "0 16px", height: 44, fontSize: 13,
                    cursor: tPage >= totPg - 1 ? "not-allowed" : "pointer",
                    color: "var(--text)", opacity: tPage >= totPg - 1 ? 0.4 : 1,
                  }}
                >
                  Siguiente →
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {selRow && (
        <div
          onClick={() => setSelRow(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40, display: "flex", alignItems: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", borderRadius: "16px 16px 0 0", padding: "20px 16px 32px", width: "100%", maxHeight: "80vh", overflowY: "auto", boxSizing: "border-box" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{fmtPointTime(selRow)}</span>
              <button
                onClick={() => setSelRow(null)}
                style={{ background: "none", border: "none", fontSize: 22, color: "var(--text-2)", cursor: "pointer", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ×
              </button>
            </div>
            {([
              ["Suministro", selRow.supply.toFixed(1) + "°C"],
              ["Retorno", selRow.return_.toFixed(1) + "°C"],
              ["Setpoint", selRow.setpoint.toFixed(1) + "°C"],
              ["Zona 1", selRow.z1.toFixed(1) + "°C"],
              ["Zona 2", selRow.z2.toFixed(1) + "°C"],
              ["Zona 3", selRow.z3.toFixed(1) + "°C"],
              ["Zona 4", selRow.z4.toFixed(1) + "°C"],
              ["Humedad", selRow.humidity.toFixed(1) + "%"],
              ["CO₂", selRow.co2.toFixed(1) + "%"],
              ["Ventilación", selRow.ventilation.toFixed(1) + "%"],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--sep)" }}>
                <span style={{ color: "var(--text-2)", fontSize: 14 }}>{label}</span>
                <span style={{ fontWeight: 500, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
