import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { fetchSeries, type SeriesPoint } from "../api";

type Key =
  | "supply"
  | "return_"
  | "setpoint"
  | "z1"
  | "z2"
  | "z3"
  | "z4"
  | "humidity"
  | "co2";

type Row = { ts: number } & Record<Key, number | null>;

type SeriesInfo = {
  key: Key;
  label: string;
  color: string;
  kind: "temp" | "hum" | "co2";
  dashed?: boolean;
};

const SERIES: SeriesInfo[] = [
  { key: "supply", label: "Suministro", color: "#3AA76D", kind: "temp" },
  { key: "return_", label: "Retorno", color: "#E24B4B", kind: "temp" },
  { key: "setpoint", label: "Set temperatura", color: "#D4A017", kind: "temp", dashed: true },
  { key: "z1", label: "Zona 1", color: "#2F6BFF", kind: "temp" },
  { key: "z2", label: "Zona 2", color: "#0E9A8A", kind: "temp" },
  { key: "z3", label: "Zona 3", color: "#E07A2F", kind: "temp" },
  { key: "z4", label: "Zona 4", color: "#7B5EA7", kind: "temp" },
  { key: "humidity", label: "Humedad relativa", color: "#2BB3C7", kind: "hum" },
  { key: "co2", label: "CO₂", color: "#8B5E3B", kind: "co2" },
];

const CHART_VIEWS: { id: string; label: string; keys: Key[] }[] = [
  { id: "estandar", label: "Estándar", keys: ["supply", "return_", "setpoint"] },
  { id: "zonas", label: "Zonas", keys: ["z1", "z2", "z3", "z4", "setpoint"] },
  { id: "gases", label: "Gases y humedad", keys: ["humidity", "co2"] },
  { id: "completo", label: "Completo", keys: SERIES.map((s) => s.key) },
];

const TABLE_VIEWS: { id: string; label: string; keys: Key[]; hours?: number }[] = [
  { id: "12h", label: "Últimas 12 h", keys: ["supply", "return_", "humidity", "co2", "setpoint"], hours: 12 },
  { id: "basico", label: "Básico (Temp, HR, CO₂)", keys: ["supply", "return_", "humidity", "co2", "setpoint"] },
  { id: "temps", label: "Solo temperaturas", keys: ["supply", "return_", "setpoint", "z1", "z2", "z3", "z4"] },
  { id: "gases", label: "Gases y humedad", keys: ["humidity", "co2", "setpoint"] },
  { id: "completo", label: "Completo", keys: SERIES.map((s) => s.key) },
];

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function toRows(points: SeriesPoint[]): Row[] {
  return points
    .map((p) => {
      const ts = new Date(p.ts).getTime();
      return {
        ts,
        supply: num(p.supply_air_c) === 0 ? null : num(p.supply_air_c),
        return_: num(p.return_air_c) === 0 ? null : num(p.return_air_c),
        setpoint: num(p.setpoint_c),
        z1: num(p.usda1_c),
        z2: num(p.usda2_c),
        z3: num(p.usda3_c),
        z4: num(p.usda4_c),
        humidity: num(p.humidity_pct) === 0 ? null : num(p.humidity_pct),
        co2: num(p.co2_pct),
      };
    })
    .filter((r) => Number.isFinite(r.ts))
    .sort((a, b) => a.ts - b.ts);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDT(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtStamp(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtAxisTime(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function hoursAgo(h: number) {
  return toDT(new Date(Date.now() - h * 3600000));
}

function dispTemp(c: number, unit: "C" | "F") {
  return unit === "F" ? c * 9 / 5 + 32 : c;
}

function fmtNum(v: number | null, digits = 1) {
  return v == null ? "—" : v.toFixed(digits);
}

const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #E3E8EF",
  borderRadius: 12,
  boxShadow: "0 1px 2px rgba(18,38,63,0.05)",
};

const field: CSSProperties = {
  width: "100%",
  height: 36,
  borderRadius: 8,
  border: "1px solid #D5DEE8",
  padding: "0 10px",
  color: "#1B2430",
  background: "#fff",
  fontSize: 13,
};

const btn: CSSProperties = {
  width: "100%",
  height: 38,
  borderRadius: 8,
  border: "1px solid #D5DEE8",
  background: "#fff",
  color: "#1B2430",
  fontWeight: 600,
  fontSize: 13,
};

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Chart({
  rows,
  active,
  showValues,
  unit,
  xMin,
  xMax,
  onZoom,
}: {
  rows: Row[];
  active: SeriesInfo[];
  showValues: Set<Key>;
  unit: "C" | "F";
  xMin: number;
  xMax: number;
  onZoom: (a: number, b: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(720);
  const drag = useRef<{ sx: number; sts: number; on: boolean } | null>(null);
  const [band, setBand] = useState<{ x1: number; x2: number } | null>(null);
  const [tip, setTip] = useState<{ x: number; row: Row } | null>(null);

  useEffect(() => {
    const obs = new ResizeObserver((es) => {
      const w = es[0]?.contentRect.width;
      if (w) setCw(Math.floor(w));
    });
    if (box.current) obs.observe(box.current);
    return () => obs.disconnect();
  }, []);

  const ch = 420;
  const hasHum = active.some((s) => s.kind === "hum");
  const hasCo2 = active.some((s) => s.kind === "co2");
  const PL = 52;
  const PR = 16 + (hasHum ? 36 : 0) + (hasCo2 ? 36 : 0);
  const PT = 16;
  const PB = 32;
  const iW = Math.max(10, cw - PL - PR);
  const iH = ch - PT - PB;

  const visible = rows.filter((r) => r.ts >= xMin && r.ts <= xMax);
  const temps = visible.flatMap((r) =>
    active.filter((s) => s.kind === "temp").map((s) => r[s.key]).filter((v): v is number => v != null).map((v) => dispTemp(v, unit))
  );
  let y0 = temps.length ? Math.min(...temps) : unit === "F" ? 60 : 15;
  let y1 = temps.length ? Math.max(...temps) : unit === "F" ? 90 : 35;
  const padY = Math.max(unit === "F" ? 2 : 1, (y1 - y0) * 0.12);
  y0 -= padY;
  y1 += padY;
  const co2Vals = visible.map((r) => r.co2).filter((v): v is number => v != null);
  const co2Max = Math.max(2, ...(co2Vals.length ? co2Vals : [2])) * 1.15;

  const sx = (ts: number) => PL + ((ts - xMin) / (xMax - xMin || 1)) * iW;
  const syT = (v: number) => PT + (1 - (dispTemp(v, unit) - y0) / (y1 - y0 || 1)) * iH;
  const syH = (v: number) => PT + (1 - v / 100) * iH;
  const syC = (v: number) => PT + (1 - v / co2Max) * iH;
  const sy = (s: SeriesInfo, v: number) => (s.kind === "hum" ? syH(v) : s.kind === "co2" ? syC(v) : syT(v));

  const polys = (s: SeriesInfo) => {
    const parts: string[] = [];
    let cur: string[] = [];
    for (const r of visible) {
      const v = r[s.key];
      if (v == null) {
        if (cur.length > 1) parts.push(cur.join(" "));
        cur = [];
        continue;
      }
      cur.push(`${sx(r.ts).toFixed(1)},${sy(s, v).toFixed(1)}`);
    }
    if (cur.length > 1) parts.push(cur.join(" "));
    return parts;
  };

  const ticks = 5;
  const yTicks = Array.from({ length: ticks }, (_, i) => y0 + ((y1 - y0) * i) / (ticks - 1));
  const xTicks = Array.from({ length: 6 }, (_, i) => xMin + ((xMax - xMin) * i) / 5);

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    if (drag.current) {
      if (Math.abs(mx - drag.current.sx) > 8) drag.current.on = true;
      if (drag.current.on) setBand({ x1: Math.min(drag.current.sx, mx), x2: Math.max(drag.current.sx, mx) });
      return;
    }
    if (!visible.length || mx < PL || mx > cw - PR) {
      setTip(null);
      return;
    }
    const ts = xMin + ((mx - PL) / iW) * (xMax - xMin);
    const row = visible.reduce((p, c) => (Math.abs(c.ts - ts) < Math.abs(p.ts - ts) ? c : p));
    setTip({ x: sx(row.ts), row });
  };

  const onDown = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const ts = xMin + ((mx - PL) / iW) * (xMax - xMin);
    drag.current = { sx: mx, sts: ts, on: false };
    setTip(null);
  };

  const onUp = (e: MouseEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    if (drag.current.on && Math.abs(mx - drag.current.sx) > 12) {
      const ets = xMin + ((mx - PL) / iW) * (xMax - xMin);
      const a = Math.min(drag.current.sts, ets);
      const b = Math.max(drag.current.sts, ets);
      if (b - a > 60_000) onZoom(a, b);
    }
    drag.current = null;
    setBand(null);
  };

  const labelEvery = Math.max(1, Math.floor(visible.length / 8));

  return (
    <div ref={box} style={{ width: "100%", position: "relative" }}>
      <svg
        width={cw}
        height={ch}
        style={{ display: "block", cursor: "crosshair", userSelect: "none" }}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setTip(null);
          drag.current = null;
          setBand(null);
        }}
        onMouseDown={onDown}
        onMouseUp={onUp}
      >
        {yTicks.map((v, i) => {
          const y = PT + (1 - (v - y0) / (y1 - y0 || 1)) * iH;
          return (
            <g key={i}>
              <line x1={PL} x2={cw - PR} y1={y} y2={y} stroke="#EEF2F6" />
              <text x={PL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#8A97A8">
                {v.toFixed(0)}
              </text>
            </g>
          );
        })}
        {hasHum &&
          [0, 50, 100].map((v) => (
            <text key={`h${v}`} x={cw - (hasCo2 ? 40 : 6)} y={syH(v) + 4} textAnchor="end" fontSize="11" fill="#2BB3C7">
              {v}
            </text>
          ))}
        {hasCo2 &&
          [0, co2Max / 2, co2Max].map((v, i) => (
            <text key={`c${i}`} x={cw - 6} y={syC(v) + 4} textAnchor="end" fontSize="11" fill="#8B5E3B">
              {v.toFixed(1)}
            </text>
          ))}
        {active.map((s) =>
          polys(s).map((pts, i) => (
            <polyline
              key={`${s.key}-${i}`}
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth={s.dashed ? 1.6 : 2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
            />
          ))
        )}
        {active.map((s) =>
          showValues.has(s.key)
            ? visible.map((r, i) => {
                const v = r[s.key];
                if (v == null || i % labelEvery !== 0) return null;
                const text = s.kind === "temp" ? dispTemp(v, unit).toFixed(1) : v.toFixed(s.kind === "co2" ? 2 : 0);
                return (
                  <text
                    key={`${s.key}-v-${i}`}
                    x={sx(r.ts)}
                    y={sy(s, v) - 6}
                    textAnchor="middle"
                    fontSize="10"
                    fill={s.color}
                    stroke="#fff"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {text}
                  </text>
                );
              })
            : null
        )}
        {xTicks.map((ts, i) => (
          <text key={i} x={sx(ts)} y={ch - 8} textAnchor="middle" fontSize="11" fill="#8A97A8">
            {fmtAxisTime(ts)}
          </text>
        ))}
        {band && <rect x={band.x1} y={PT} width={band.x2 - band.x1} height={iH} fill="rgba(47,107,255,0.12)" />}
        {tip && <line x1={tip.x} x2={tip.x} y1={PT} y2={PT + iH} stroke="#C5D0DE" strokeDasharray="3 3" />}
      </svg>
      {tip && (
        <div
          style={{
            position: "absolute",
            left: Math.min(tip.x + 12, cw - 180),
            top: 24,
            background: "#fff",
            border: "1px solid #E3E8EF",
            borderRadius: 10,
            padding: "8px 10px",
            boxShadow: "0 8px 24px rgba(18,38,63,0.12)",
            fontSize: 12,
            pointerEvents: "none",
          }}
        >
          <div style={{ color: "#66758A", marginBottom: 4 }}>{fmtStamp(tip.row.ts)}</div>
          {active.map((s) => (
            <div key={s.key} style={{ color: s.color, fontWeight: 600 }}>
              {s.label}: {s.kind === "temp" ? (tip.row[s.key] == null ? "—" : dispTemp(tip.row[s.key] as number, unit).toFixed(1) + "°") : fmtNum(tip.row[s.key], s.kind === "co2" ? 2 : 0)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Historico({ ident = "POLLO_BEBE" }: { ident?: string }) {
  const [mode, setMode] = useState<"grafico" | "tabla">("grafico");
  const [unit, setUnit] = useState<"C" | "F">("C");
  const [startIn, setStartIn] = useState(() => hoursAgo(12));
  const [endIn, setEndIn] = useState(() => toDT(new Date()));
  const [query, setQuery] = useState(() => ({ start: hoursAgo(12), end: toDT(new Date()) }));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [view, setView] = useState("estandar");
  const [tableView, setTableView] = useState("12h");
  const [active, setActive] = useState<Set<Key>>(() => new Set(["supply", "return_", "setpoint"]));
  const [cols, setCols] = useState<Set<Key>>(() => new Set(["supply", "return_", "humidity", "co2", "setpoint"]));
  const [showValues, setShowValues] = useState<Set<Key>>(new Set());
  const [findVar, setFindVar] = useState("");
  const [zoom, setZoom] = useState<{ a: number; b: number } | null>(null);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");

  useEffect(() => {
    const start = new Date(query.start);
    const end = new Date(query.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setErr("El periodo no es válido");
      setLoading(false);
      return;
    }
    const hours = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 3600000));
    let cancel = false;
    setLoading(true);
    setErr("");
    fetchSeries(hours, ident, start.toISOString(), end.toISOString())
      .then((points) => {
        if (cancel) return;
        const next = toRows(points).filter((r) => r.ts >= start.getTime() && r.ts <= end.getTime());
        setRows(next);
        setZoom(null);
        setPage(0);
      })
      .catch(() => {
        if (!cancel) setErr("No se pudo leer el histórico");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [query, ident]);

  const domain = useMemo(() => {
    if (!rows.length) return { min: Date.now() - 3600000, max: Date.now() };
    return { min: rows[0].ts, max: rows[rows.length - 1].ts };
  }, [rows]);
  const xMin = zoom?.a ?? domain.min;
  const xMax = zoom?.b ?? domain.max;
  const shown = SERIES.filter((s) => active.has(s.key));
  const filteredSeries = SERIES.filter((s) => s.label.toLowerCase().includes(findVar.trim().toLowerCase()));
  const tableSeries = SERIES.filter((s) => cols.has(s.key));

  const tableRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => !needle || fmtStamp(r.ts).toLowerCase().includes(needle));
  }, [rows, q]);
  const pageSize = 40;
  const pages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const pageRows = tableRows.slice(page * pageSize, (page + 1) * pageSize);

  const applyView = (id: string) => {
    const found = CHART_VIEWS.find((v) => v.id === id);
    if (!found) return;
    setView(id);
    setActive(new Set(found.keys));
  };

  const applyTableView = (id: string) => {
    const found = TABLE_VIEWS.find((v) => v.id === id);
    if (!found) return;
    setTableView(id);
    setCols(new Set(found.keys));
    if (found.hours) {
      const start = hoursAgo(found.hours);
      const end = toDT(new Date());
      setStartIn(start);
      setEndIn(end);
      setQuery({ start, end });
    }
  };

  const toggle = (set: Set<Key>, key: Key, write: (n: Set<Key>) => void) => {
    const n = new Set(set);
    n.has(key) ? n.delete(key) : n.add(key);
    write(n);
  };

  const exportRows = () => tableRows;
  const fileBase = `historico_${ident}_${query.start.slice(0, 10)}_${query.end.slice(0, 10)}`;

  const downloadCsv = () => {
    const head = ["Fecha / Hora", ...tableSeries.map((s) => s.label)];
    const lines = exportRows().map((r) =>
      [fmtStamp(r.ts), ...tableSeries.map((s) => (s.kind === "temp" && r[s.key] != null ? dispTemp(r[s.key] as number, unit).toFixed(1) : fmtNum(r[s.key], s.kind === "co2" ? 2 : 1)))].join(";")
    );
    downloadBlob(`${fileBase}.csv`, new Blob(["\uFEFF" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
  };

  const downloadExcel = () => {
    const head = ["Fecha / Hora", ...tableSeries.map((s) => s.label)].map((h) => `<th>${h}</th>`).join("");
    const body = exportRows()
      .map((r) => {
        const cells = [fmtStamp(r.ts), ...tableSeries.map((s) => (s.kind === "temp" && r[s.key] != null ? dispTemp(r[s.key] as number, unit).toFixed(1) : fmtNum(r[s.key], s.kind === "co2" ? 2 : 1)))];
        return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
      })
      .join("");
    const html = `<html><head><meta charset="utf-8"></head><body><table border="1"><tr>${head}</tr>${body}</table></body></html>`;
    downloadBlob(`${fileBase}.xls`, new Blob([html], { type: "application/vnd.ms-excel" }));
  };

  const downloadPdf = () => {
    const head = ["Fecha / Hora", ...tableSeries.map((s) => s.label)];
    const body = exportRows()
      .map((r) => {
        const cells = [fmtStamp(r.ts), ...tableSeries.map((s) => (s.kind === "temp" && r[s.key] != null ? dispTemp(r[s.key] as number, unit).toFixed(1) : fmtNum(r[s.key], s.kind === "co2" ? 2 : 1)))];
        return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
      })
      .join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${fileBase}</title>
      <style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#1B2430}h1{font-size:18px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border-bottom:1px solid #E3E8EF;padding:6px 8px;text-align:left}th{background:#F4F6F9}</style>
      </head><body><h1>Datos históricos — ${ident}</h1><p>${fmtStamp(new Date(query.start).getTime())} — ${fmtStamp(new Date(query.end).getTime())}</p>
      <table><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>${body}</table><script>window.print()</script></body></html>`);
    w.document.close();
  };

  const sideLabel: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#66758A", letterSpacing: "0.04em", textTransform: "uppercase", margin: "14px 0 8px" };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1B2430" }}>{mode === "grafico" ? "Datos históricos" : "Datos en tabla"}</h1>
          <p style={{ fontSize: 13, color: "#66758A" }}>Visualizando historial — {ident}</p>
        </div>
        <div style={{ display: "flex", background: "#fff", border: "1px solid #E3E8EF", borderRadius: 10, padding: 3 }}>
          {(["grafico", "tabla"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
                background: mode === id ? "#2F6BFF" : "transparent",
                color: mode === id ? "#fff" : "#66758A",
              }}
            >
              {id === "grafico" ? "Gráfico" : "Tabla"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4 items-start">
        <aside style={{ ...card, padding: 16 }}>
          <div style={sideLabel}>Periodo de búsqueda</div>
          <label style={{ fontSize: 12, color: "#66758A" }}>Inicio</label>
          <input style={{ ...field, margin: "4px 0 8px" }} type="datetime-local" value={startIn} onChange={(e) => setStartIn(e.target.value)} />
          <label style={{ fontSize: 12, color: "#66758A" }}>Fin</label>
          <input style={{ ...field, marginTop: 4 }} type="datetime-local" value={endIn} onChange={(e) => setEndIn(e.target.value)} />

          <div style={sideLabel}>Temperatura</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["C", "F"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                style={{ ...btn, background: unit === u ? "#2F6BFF" : "#fff", color: unit === u ? "#fff" : "#1B2430", borderColor: unit === u ? "#2F6BFF" : "#D5DEE8" }}
              >
                °{u}
              </button>
            ))}
          </div>

          <button
            type="button"
            style={{ ...btn, marginTop: 14, background: "#2F6BFF", color: "#fff", borderColor: "#2F6BFF" }}
            onClick={() => setQuery({ start: startIn, end: endIn })}
          >
            {mode === "grafico" ? "Generar gráfico" : "Generar tabla"}
          </button>

          {mode === "grafico" ? (
            <>
              <div style={sideLabel}>Vistas del gráfico</div>
              <div className="flex flex-col gap-2">
                {CHART_VIEWS.map((v) => (
                  <button key={v.id} type="button" onClick={() => applyView(v.id)} style={{ ...btn, background: view === v.id ? "#2F6BFF" : "#fff", color: view === v.id ? "#fff" : "#1B2430", borderColor: view === v.id ? "#2F6BFF" : "#D5DEE8" }}>
                    {v.label}
                  </button>
                ))}
              </div>
              <div style={sideLabel}>Variables y color</div>
              <input style={field} placeholder="Buscar variable" value={findVar} onChange={(e) => setFindVar(e.target.value)} />
              <div className="flex flex-col gap-1 mt-2">
                {filteredSeries.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-2" style={{ minHeight: 28 }}>
                    <label className="flex items-center gap-2" style={{ fontSize: 13, color: "#1B2430" }}>
                      <input type="checkbox" checked={active.has(s.key)} onChange={() => { toggle(active, s.key, setActive); setView("custom"); }} style={{ accentColor: s.color }} />
                      <span style={{ width: 10, height: 10, borderRadius: 99, background: s.color, display: "inline-block" }} />
                      {s.label}
                    </label>
                    <label style={{ fontSize: 11, color: "#66758A" }} className="flex items-center gap-1">
                      <input type="checkbox" checked={showValues.has(s.key)} onChange={() => toggle(showValues, s.key, setShowValues)} />
                      Valores
                    </label>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={sideLabel}>Vistas predefinidas</div>
              <div className="flex flex-col gap-2">
                {TABLE_VIEWS.map((v) => (
                  <button key={v.id} type="button" onClick={() => applyTableView(v.id)} style={{ ...btn, background: tableView === v.id ? "#2F6BFF" : "#fff", color: tableView === v.id ? "#fff" : "#1B2430", borderColor: tableView === v.id ? "#2F6BFF" : "#D5DEE8" }}>
                    {v.label}
                  </button>
                ))}
              </div>
              <div style={sideLabel}>Columnas a mostrar</div>
              {SERIES.map((s) => (
                <label key={s.key} className="flex items-center gap-2" style={{ fontSize: 13, minHeight: 26 }}>
                  <input type="checkbox" checked={cols.has(s.key)} onChange={() => { toggle(cols, s.key, setCols); setTableView("custom"); }} style={{ accentColor: s.color }} />
                  {s.label}
                </label>
              ))}
            </>
          )}
        </aside>

        <section style={{ ...card, padding: 16, minHeight: 480 }}>
          {mode === "grafico" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span style={{ fontSize: 13, color: "#66758A" }}>
                  {loading ? "Cargando lecturas…" : `${rows.length} lecturas`}
                  {err ? ` · ${err}` : ""}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={downloadPdf} style={{ ...btn, width: "auto", padding: "0 12px" }}>Descargar PDF</button>
                  <button type="button" onClick={downloadCsv} style={{ ...btn, width: "auto", padding: "0 12px" }}>Descargar CSV</button>
                  <button type="button" onClick={downloadExcel} style={{ ...btn, width: "auto", padding: "0 12px" }}>Descargar Excel</button>
                <button
                  type="button"
                  onClick={() => setZoom(null)}
                  style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid #D5DEE8", background: "#fff", fontSize: 13, fontWeight: 600 }}
                >
                  Restablecer zoom
                </button>
                </div>
              </div>
              {!loading && !rows.length ? (
                <p style={{ color: "#66758A", padding: 24 }}>No hay lecturas en este periodo.</p>
              ) : (
                <Chart rows={rows} active={shown} showValues={showValues} unit={unit} xMin={xMin} xMax={xMax} onZoom={(a, b) => setZoom({ a, b })} />
              )}
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {shown.map((s) => (
                  <span key={s.key} style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>
                    {s.dashed ? "— " : "━ "}
                    {s.label}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "#8A97A8", textAlign: "center", marginTop: 6 }}>Arrastra sobre el gráfico para acercar un tramo.</p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button type="button" onClick={downloadPdf} style={{ ...btn, width: "auto", padding: "0 12px" }}>Descargar PDF</button>
                <button type="button" onClick={downloadCsv} style={{ ...btn, width: "auto", padding: "0 12px" }}>Descargar CSV</button>
                <button type="button" onClick={downloadExcel} style={{ ...btn, width: "auto", padding: "0 12px" }}>Descargar Excel</button>
                <input style={{ ...field, width: 180, marginLeft: "auto" }} placeholder="Buscar por fecha" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
              </div>
              <div style={{ overflow: "auto", maxHeight: 560 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Fecha / Hora", ...tableSeries.map((s) => s.label)].map((h) => (
                        <th key={h} style={{ position: "sticky", top: 0, background: "#F4F6F9", textAlign: "left", padding: "8px 10px", color: "#66758A", fontWeight: 600, borderBottom: "1px solid #E3E8EF" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => (
                      <tr key={r.ts + "-" + i} style={{ background: i % 2 ? "#F8FAFC" : "#fff" }}>
                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #EEF2F6", whiteSpace: "nowrap" }}>{fmtStamp(r.ts)}</td>
                        {tableSeries.map((s) => {
                          const raw = r[s.key];
                          const text = s.kind === "temp" && raw != null ? dispTemp(raw, unit).toFixed(1) : fmtNum(raw, s.kind === "co2" ? 2 : 0);
                          const hot = s.kind === "temp" && raw != null && r.setpoint != null && s.key !== "setpoint" && Math.abs(raw - r.setpoint) > 1.5;
                          return (
                            <td key={s.key} style={{ padding: "7px 10px", borderBottom: "1px solid #EEF2F6", color: hot ? "#E24B4B" : "#1B2430", fontWeight: hot ? 700 : 500 }}>
                              {text}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!pageRows.length && <p style={{ color: "#66758A", padding: 16 }}>{loading ? "Cargando…" : "No hay filas en este periodo."}</p>}
              </div>
              <div className="flex items-center justify-between mt-3" style={{ fontSize: 13, color: "#66758A" }}>
                <span>{tableRows.length} filas</span>
                <div className="flex gap-2">
                  <button type="button" style={{ ...btn, width: "auto", padding: "0 10px" }} disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</button>
                  <span style={{ lineHeight: "38px" }}>{page + 1} / {pages}</span>
                  <button type="button" style={{ ...btn, width: "auto", padding: "0 10px" }} disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
