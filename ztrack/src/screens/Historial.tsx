import { useEffect, useState } from "react";
import { fetchCommandHistory, type CommandHistoryItem } from "../api";

const TIPOS = [
  { id: "all", label: "Todo" },
  { id: "comandos", label: "Comandos" },
  { id: "reles", label: "Relés" },
  { id: "reglas", label: "Reglas" },
] as const;

const ESTADOS = [
  { id: "all", label: "Todos" },
  { id: "sent", label: "Aplicados" },
  { id: "queued", label: "En espera" },
  { id: "canceled", label: "Cancelados" },
  { id: "error", label: "Error" },
] as const;

function tipoDe(item: CommandHistoryItem) {
  if (item.origin === "reglas" || item.kind === "pantalla_cmd") return "Regla";
  if (item.origin === "reles" || item.kind === "relay_set" || item.kind === "relay_pot") return "Relé";
  return "Comando";
}

function estadoDe(status?: string, reason?: string | null) {
  if (status === "sent") return { text: "Aplicado", color: "#1F9D55" };
  if (status === "queued" || status === "window_wait") return { text: "En espera", color: "#C47B12" };
  if (status === "canceled") {
    return { text: reason === "expired_10m" ? "Cancelado (10 min)" : "Cancelado", color: "#8A97A8" };
  }
  if (status === "error") return { text: "Error", color: "#E24B4B" };
  if (status === "reference") return { text: "Sin sesión", color: "#8A97A8" };
  return { text: status || "—", color: "#8A97A8" };
}

function cuando(item: CommandHistoryItem) {
  const iso = item.sent_at || item.enqueued_at || item.ts;
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function detalle(item: CommandHistoryItem) {
  const label = item.label || item.kind || "—";
  if ((item.kind === "relay_set" || item.kind === "relay_pot") && item.expected != null) {
    const bits = String(item.expected);
    if (/^[01]{10}$/.test(bits)) {
      const on = bits.split("").map((b, i) => (b === "0" ? i + 1 : 0)).filter(Boolean);
      return `${label}. Encendidos: ${on.length ? on.join(", ") : "ninguno"}`;
    }
  }
  if (item.kind === "mp5000_write" && item.expected != null && item.expected !== "") {
    return `${label}: ${item.expected}`;
  }
  return label;
}

export default function Historial({ ident }: { ident: string }) {
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["id"]>("all");
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]["id"]>("all");
  const [rows, setRows] = useState<CommandHistoryItem[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = false;
    const load = () => {
      fetchCommandHistory(ident, tipo)
        .then((items) => {
          if (!stop) {
            setRows(items);
            setErr("");
          }
        })
        .catch((e) => {
          if (!stop) setErr(e instanceof Error ? e.message : "Error");
        });
    };
    load();
    const t = setInterval(load, 8000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [ident, tipo]);

  const shown = rows.filter((r) => {
    if (estado === "all") return true;
    if (estado === "queued") return r.status === "queued" || r.status === "window_wait";
    return r.status === estado;
  });

  const chip = (active: boolean) => ({
    height: 32,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid var(--sep)",
    background: active ? "#2F6BFF" : "#fff",
    color: active ? "#fff" : "var(--text)",
    fontWeight: 600,
    fontSize: 13,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-semibold" style={{ fontSize: 22 }}>Historial aplicado</h1>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
          Comandos, relés y reglas enviados al equipo {ident}. La hora es la de Lima.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <button key={t.id} type="button" style={chip(tipo === t.id)} onClick={() => setTipo(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {ESTADOS.map((t) => (
          <button key={t.id} type="button" style={chip(estado === t.id)} onClick={() => setEstado(t.id)}>{t.label}</button>
        ))}
      </div>
      {err && <p style={{ color: "var(--c-red)", fontSize: 14 }}>{err}</p>}
      <div className="rounded-[14px] overflow-auto" style={{ background: "var(--surface)", border: "1px solid var(--sep)", boxShadow: "var(--shadow)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-2)" }}>
              {["Cuándo", "Tipo", "Equipo", "Detalle", "Usuario", "Estado"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", fontWeight: 600, borderBottom: "1px solid var(--sep)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => {
              const st = estadoDe(row.status, row.reason);
              return (
                <tr key={row.queue_id || i} style={{ borderBottom: "1px solid var(--sep)" }}>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{cuando(row)}</td>
                  <td style={{ padding: "10px 14px" }}>{tipoDe(row)}</td>
                  <td style={{ padding: "10px 14px" }}>{row.i || ident}</td>
                  <td style={{ padding: "10px 14px" }}>{detalle(row)}</td>
                  <td style={{ padding: "10px 14px" }}>{row.username || "—"}</td>
                  <td style={{ padding: "10px 14px", color: st.color, fontWeight: 700 }}>{st.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && (
          <p style={{ padding: 16, fontSize: 13, color: "var(--text-2)" }}>
            Todavía no hay registros en este filtro.
          </p>
        )}
      </div>
    </div>
  );
}
