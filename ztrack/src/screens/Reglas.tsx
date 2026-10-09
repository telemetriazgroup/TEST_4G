import { useEffect, useState, type CSSProperties } from "react";
import { deleteProgram, enqueueCommand, fetchPrograms, fetchRuleCatalog, saveProgram, type LiveSnapshot } from "../api";

type Step = {
  tipo: "if" | "else" | "endif";
  entrada?: string;
  operador?: string;
  valor?: number;
  salida?: string;
  estado?: number;
  tiempo?: number;
  permanente?: boolean;
};

type Saved = { id: string; name: string; reglas: Step[]; label?: string };

const field: CSSProperties = {
  height: 38,
  borderRadius: 10,
  border: "1px solid var(--sep)",
  padding: "0 10px",
  background: "#fff",
  color: "var(--text)",
  width: "100%",
};

export default function Reglas({ live, username }: { live: LiveSnapshot | null; username: string }) {
  const [entradas, setEntradas] = useState<{ name: string; unit: string }[]>([]);
  const [salidas, setSalidas] = useState<{ name: string; help: string }[]>([]);
  const [operadores, setOperadores] = useState<{ name: string }[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState({ entrada: "Suministro", operador: "MAYOR  (>)", valor: "30", salida: "RELAY1", estado: "0", tiempo: "60", permanente: false });
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    const [cat, rows] = await Promise.all([
      fetchRuleCatalog(live?.ident || "POLLO_BEBE"),
      fetchPrograms(live?.ident || "POLLO_BEBE"),
    ]);
    setEntradas(cat.tables?.entradas || []);
    setSalidas(cat.tables?.salidas || []);
    setOperadores(cat.tables?.operadores || []);
    setSaved(rows);
  };

  useEffect(() => {
    load().catch((e) => setErr(e.message || "Error"));
  }, [live?.ident]);

  const addIf = () => {
    setSteps((prev) => [
      ...prev,
      {
        tipo: "if",
        entrada: draft.entrada,
        operador: draft.operador,
        valor: Number(draft.valor),
        salida: draft.salida,
        estado: Number(draft.estado),
        tiempo: Number(draft.tiempo),
        permanente: draft.permanente,
      },
    ]);
  };

  const send = async (reglas: Step[], label: string) => {
    setErr("");
    setNote("");
    const res = await enqueueCommand({
      ident: live?.ident || "POLLO_BEBE",
      ip: live?.ip || null,
      addr: live?.addr || null,
      kind: "pantalla_cmd",
      reglas,
      label,
      username,
    });
    setNote(res.status === "queued" ? "Programa encolado" : "Programa guardado como referencia: el equipo no tiene sesión");
  };

  const store = async () => {
    setErr("");
    setNote("");
    try {
      await saveProgram({ ident: live?.ident || "POLLO_BEBE", name, reglas: steps, username });
      setName("");
      setSteps([]);
      setNote("Regla guardada");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-semibold" style={{ fontSize: 22 }}>Reglas de control</h1>
      <p style={{ fontSize: 13, color: "var(--text-2)" }}>
        Cada regla es un SI del programa del equipo. La acción dura el tiempo indicado y no reemplaza una consigna fija.
      </p>
      {note && <p style={{ color: "var(--c-green)", fontSize: 14 }}>{note}</p>}
      {err && <p style={{ color: "var(--c-red)", fontSize: 14 }}>{err}</p>}

      <section className="rounded-[14px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--sep)" }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label style={{ fontSize: 12, color: "var(--text-2)" }}>Si
            <select style={field} value={draft.entrada} onChange={(e) => setDraft({ ...draft, entrada: e.target.value })}>
              {entradas.map((x) => <option key={x.name}>{x.name}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: "var(--text-2)" }}>Condición
            <select style={field} value={draft.operador} onChange={(e) => setDraft({ ...draft, operador: e.target.value })}>
              {operadores.map((x) => <option key={x.name}>{x.name}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: "var(--text-2)" }}>Valor
            <input style={field} value={draft.valor} onChange={(e) => setDraft({ ...draft, valor: e.target.value })} />
          </label>
          <label style={{ fontSize: 12, color: "var(--text-2)" }}>Entonces
            <select style={field} value={draft.salida} onChange={(e) => setDraft({ ...draft, salida: e.target.value })}>
              {salidas.map((x) => <option key={x.name}>{x.name}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: "var(--text-2)" }}>Estado
            <input style={field} value={draft.estado} onChange={(e) => setDraft({ ...draft, estado: e.target.value })} />
          </label>
          <label style={{ fontSize: 12, color: "var(--text-2)" }}>Segundos
            <input style={field} disabled={draft.permanente} value={draft.tiempo} onChange={(e) => setDraft({ ...draft, tiempo: e.target.value })} />
          </label>
        </div>
        <label className="flex items-center gap-2 mt-3" style={{ fontSize: 13 }}>
          <input type="checkbox" checked={draft.permanente} onChange={(e) => setDraft({ ...draft, permanente: e.target.checked })} />
          Permanente
        </label>
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" onClick={addIf} style={{ height: 36, padding: "0 12px", borderRadius: 8, background: "#2F6BFF", color: "#fff", fontWeight: 600 }}>Agregar SI</button>
          <button type="button" onClick={() => setSteps((p) => [...p, { tipo: "else" }])} style={{ height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid var(--sep)" }}>ELSE</button>
          <button type="button" onClick={() => setSteps((p) => [...p, { tipo: "endif" }])} style={{ height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid var(--sep)" }}>FIN SI</button>
        </div>
        <ol className="mt-3 flex flex-col gap-1" style={{ fontSize: 13 }}>
          {steps.map((s, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>
                {s.tipo === "if"
                  ? `SI ${s.entrada} ${s.operador} ${s.valor} → ${s.salida} = ${s.estado}${s.permanente ? " permanente" : ` por ${s.tiempo} s`}`
                  : s.tipo === "else" ? "ELSE" : "FIN SI"}
              </span>
              <button type="button" onClick={() => setSteps(steps.filter((_, j) => j !== i))} style={{ color: "#E24B4B" }}>Quitar</button>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 mt-3">
          <input style={{ ...field, maxWidth: 280 }} placeholder="Nombre de la regla" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" onClick={store} style={{ height: 38, padding: "0 14px", borderRadius: 10, background: "#12263A", color: "#fff", fontWeight: 600 }}>Guardar</button>
          <button type="button" disabled={!steps.length} onClick={() => send(steps, name || "Programa").catch((e) => setErr(e.message))} style={{ height: 38, padding: "0 14px", borderRadius: 10, background: "#2F6BFF", color: "#fff", fontWeight: 600 }}>Enviar al equipo</button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Reglas guardadas</h2>
        {saved.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-[12px] p-3" style={{ background: "var(--surface)", border: "1px solid var(--sep)" }}>
            <div>
              <p style={{ fontWeight: 600 }}>{p.name}</p>
              <p style={{ fontSize: 12, color: "var(--text-2)" }}>{p.label || `${p.reglas.length} pasos`}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => send(p.reglas, p.name).catch((e) => setErr(e.message))} style={{ height: 32, padding: "0 10px", borderRadius: 8, background: "#2F6BFF", color: "#fff", fontWeight: 600 }}>Enviar</button>
              <button type="button" onClick={() => deleteProgram(p.id).then(load).catch((e) => setErr(e.message))} style={{ height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid var(--sep)" }}>Borrar</button>
            </div>
          </div>
        ))}
        {!saved.length && <p style={{ fontSize: 13, color: "var(--text-2)" }}>Todavía no hay reglas guardadas.</p>}
      </section>
    </div>
  );
}
