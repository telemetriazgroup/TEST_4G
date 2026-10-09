import { useState } from "react";
import { enqueueCommand, type LiveSnapshot } from "../api";

export default function Reles({ live, username }: { live: LiveSnapshot | null; username: string }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const relays = live?.relays || [];
  const known = relays.length >= 10 && relays.every((r) => r.on != null);
  const slots = Array.from({ length: 10 }, (_, i) => {
    const found = relays.find((r) => r.id === i + 1);
    return { id: i + 1, name: found?.name || `Relé ${i + 1}`, on: !!found?.on };
  });

  const toggle = async (id: number) => {
    if (!known || !live) return;
    const nextOn = !slots.find((s) => s.id === id)?.on;
    const bits = slots.map((s) => ((s.id === id ? nextOn : s.on) ? "0" : "1")).join("");
    setBusy(id);
    setNote("");
    try {
      await enqueueCommand({
        ident: live.ident || "POLLO_BEBE",
        ip: live.ip || null,
        addr: live.addr || null,
        kind: "relay_set",
        bits,
        label: `Relé ${id} → ${nextOn ? "ON" : "OFF"}`,
        username,
      });
      setNote(`Relé ${id} encolado en la sesión del serial. Si no sale en 10 min se cancela.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "No se pudo enviar el relé");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-semibold" style={{ fontSize: 22 }}>Control de relés</h1>
      <p style={{ fontSize: 13, color: "var(--text-2)" }}>
        El mismo comando del serial. En el bus, 0 enciende y 1 apaga. El panel principal solo muestra el estado.
      </p>
      {note && <p style={{ color: "var(--c-green)", fontSize: 14 }}>{note}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {slots.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 rounded-[14px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--sep)", boxShadow: "var(--shadow)" }}>
            <div>
              <p style={{ fontSize: 12, color: "var(--text-2)" }}>R{s.id}</p>
              <p style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: s.on ? "#1F9D55" : "#8A97A8" }}>{s.on ? "ON" : "OFF"}</p>
            </div>
            <button
              type="button"
              disabled={!known || busy != null}
              onClick={() => toggle(s.id)}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                background: s.on ? "#E24B4B" : "#1F9D55",
                color: "#fff",
                fontWeight: 700,
                opacity: known ? 1 : 0.5,
              }}
            >
              {busy === s.id ? "…" : s.on ? "Apagar" : "Encender"}
            </button>
          </div>
        ))}
      </div>
      {!known && <p style={{ fontSize: 13, color: "var(--c-amber)" }}>Hace falta una lectura completa de los 10 relés antes de enviar un cambio.</p>}
    </div>
  );
}
