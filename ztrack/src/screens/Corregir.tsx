import { useState } from "react";
import { fetchReadings, saveReading, type ReadingRow } from "../api";

const FIELDS: { key: keyof ReadingRow; label: string }[] = [
  { key: "supply_air_c", label: "Suministro" },
  { key: "return_air_c", label: "Retorno" },
  { key: "setpoint_c", label: "Set" },
  { key: "usda1_c", label: "Zona 1" },
  { key: "usda2_c", label: "Zona 2" },
  { key: "usda3_c", label: "Zona 3" },
  { key: "usda4_c", label: "Zona 4" },
  { key: "humidity_pct", label: "Humedad" },
  { key: "co2_pct", label: "CO₂" },
];

function toDT(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function stamp(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("es-PE", { timeZone: "America/Lima", hour12: false });
}

function draftFrom(row: ReadingRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = row[f.key];
    out[f.key] = typeof v === "number" ? String(v) : "";
  }
  return out;
}

export default function Corregir({ ident }: { ident: string }) {
  const [start, setStart] = useState(() => toDT(new Date(Date.now() - 12 * 3600000)));
  const [end, setEnd] = useState(() => toDT(new Date()));
  const [rows, setRows] = useState<ReadingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const limit = 80;

  const load = async (nextSkip = skip) => {
    const a = new Date(start);
    const b = new Date(end);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) {
      setErr("El periodo no es válido");
      return;
    }
    setErr("");
    setNote("");
    const data = await fetchReadings(ident, a.toISOString(), b.toISOString(), nextSkip, limit);
    setRows(data.items || []);
    setTotal(data.total || 0);
    setSkip(data.skip || 0);
    const next: Record<string, Record<string, string>> = {};
    for (const row of data.items || []) next[row.id] = draftFrom(row);
    setDrafts(next);
  };

  const save = async (row: ReadingRow, mode: "save" | "void" | "restore") => {
    setBusy(row.id);
    setErr("");
    setNote("");
    try {
      if (mode === "void") await saveReading(row.id, { void: true });
      else if (mode === "restore") await saveReading(row.id, { restore: true });
      else {
        const fields: Record<string, number | null> = {};
        const draft = drafts[row.id] || {};
        for (const f of FIELDS) {
          const raw = (draft[f.key] || "").trim().replace(",", ".");
          fields[f.key] = raw === "" ? null : Number(raw);
          if (raw !== "" && Number.isNaN(fields[f.key])) {
            throw new Error(`${f.label} no es un número`);
          }
        }
        await saveReading(row.id, { fields });
      }
      setNote(mode === "void" ? "Lectura anulada: ya no entra al gráfico" : mode === "restore" ? "Lectura restaurada" : "Lectura guardada");
      await load(skip);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy("");
    }
  };

  const inputStyle = {
    width: 72,
    height: 32,
    borderRadius: 8,
    border: "1px solid var(--sep)",
    padding: "0 6px",
    background: "#fff",
    color: "var(--text)",
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-semibold" style={{ fontSize: 22 }}>Corregir lecturas</h1>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
          Cambia o anula una lectura falsa de {ident}. El gráfico y la tabla dejan de usar el valor anulado. Una celda vacía tampoco se grafica.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label style={{ fontSize: 12, color: "var(--text-2)" }}>Desde
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...inputStyle, width: 210, display: "block" }} />
        </label>
        <label style={{ fontSize: 12, color: "var(--text-2)" }}>Hasta
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...inputStyle, width: 210, display: "block" }} />
        </label>
        <button type="button" onClick={() => load(0).catch((e) => setErr(e.message))} style={{ height: 34, padding: "0 14px", borderRadius: 8, background: "#2F6BFF", color: "#fff", fontWeight: 700 }}>
          Cargar
        </button>
        <span style={{ fontSize: 13, color: "var(--text-2)" }}>{total ? `${skip + 1}–${Math.min(skip + rows.length, total)} de ${total}` : ""}</span>
        <button type="button" disabled={skip <= 0} onClick={() => load(Math.max(0, skip - limit)).catch((e) => setErr(e.message))} style={{ height: 34, padding: "0 10px", borderRadius: 8, border: "1px solid var(--sep)" }}>Anterior</button>
        <button type="button" disabled={skip + limit >= total} onClick={() => load(skip + limit).catch((e) => setErr(e.message))} style={{ height: 34, padding: "0 10px", borderRadius: 8, border: "1px solid var(--sep)" }}>Siguiente</button>
      </div>
      {note && <p style={{ color: "#1F9D55", fontSize: 14 }}>{note}</p>}
      {err && <p style={{ color: "#E24B4B", fontSize: 14 }}>{err}</p>}
      <div className="rounded-[14px] overflow-auto" style={{ background: "var(--surface)", border: "1px solid var(--sep)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-2)" }}>
              <th style={{ padding: "10px 8px" }}>Hora (Lima)</th>
              {FIELDS.map((f) => <th key={f.key} style={{ padding: "10px 8px" }}>{f.label}</th>)}
              <th style={{ padding: "10px 8px" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid var(--sep)", opacity: row.voided ? 0.55 : 1 }}>
                <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                  {stamp(row.ts)}
                  {row.voided && <div style={{ color: "#C47B12", fontWeight: 700 }}>Anulada</div>}
                </td>
                {FIELDS.map((f) => (
                  <td key={f.key} style={{ padding: "6px" }}>
                    <input
                      value={drafts[row.id]?.[f.key] ?? ""}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], [f.key]: e.target.value } }))}
                      style={inputStyle}
                    />
                  </td>
                ))}
                <td style={{ padding: "6px", whiteSpace: "nowrap" }}>
                  <button type="button" disabled={busy === row.id} onClick={() => save(row, "save")} style={{ height: 30, marginRight: 6, padding: "0 8px", borderRadius: 8, background: "#12263A", color: "#fff", fontWeight: 700 }}>Guardar</button>
                  <button type="button" disabled={busy === row.id} onClick={() => save(row, "void")} style={{ height: 30, marginRight: 6, padding: "0 8px", borderRadius: 8, border: "1px solid #E24B4B", color: "#E24B4B", fontWeight: 700 }}>Anular</button>
                  <button type="button" disabled={busy === row.id} onClick={() => save(row, "restore")} style={{ height: 30, padding: "0 8px", borderRadius: 8, border: "1px solid var(--sep)" }}>Restaurar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p style={{ padding: 16, fontSize: 13, color: "var(--text-2)" }}>Carga un periodo para ver las lecturas guardadas.</p>}
      </div>
    </div>
  );
}
