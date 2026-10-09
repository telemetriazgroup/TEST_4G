import { useEffect, useState, type ChangeEvent, type CSSProperties } from "react";
import { fetchProfile, saveProfile, type Profile, type Session } from "../api";

const field: CSSProperties = {
  height: 40,
  width: "100%",
  borderRadius: 10,
  border: "1px solid var(--sep)",
  padding: "0 12px",
  background: "#fff",
  color: "var(--text)",
};

export default function Perfil({ session, onSaved }: { session: Session; onSaved: (next: Session) => void }) {
  const [form, setForm] = useState<Profile>({
    username: session.username,
    name: session.name,
    nombre: session.nombre || "",
    apellido: session.apellido || "",
    correo: session.correo || "",
    cargo: session.cargo || "",
    empresa: session.empresa || "",
    role: session.role,
  });
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetchProfile(session.username)
      .then((p) => setForm(p))
      .catch((e) => setErr(e.message || "Error"));
  }, [session.username]);

  const save = async () => {
    setErr("");
    setNote("");
    try {
      const user = await saveProfile(form);
      onSaved({
        ...session,
        name: user.name,
        nombre: user.nombre,
        apellido: user.apellido,
        correo: user.correo,
        cargo: user.cargo,
        empresa: user.empresa,
      });
      setNote("Perfil actualizado");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  };

  const set = (key: keyof Profile) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 640 }}>
      <h1 className="font-semibold" style={{ fontSize: 22 }}>Mi perfil</h1>
      <p style={{ fontSize: 13, color: "var(--text-2)" }}>{form.username} · {form.role === "admin" ? "Administrador" : "Monitoreo"}</p>
      {note && <p style={{ color: "var(--c-green)" }}>{note}</p>}
      {err && <p style={{ color: "var(--c-red)" }}>{err}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label style={{ fontSize: 12, color: "var(--text-2)" }}>Nombre<input style={field} value={form.nombre} onChange={set("nombre")} /></label>
        <label style={{ fontSize: 12, color: "var(--text-2)" }}>Apellido<input style={field} value={form.apellido} onChange={set("apellido")} /></label>
        <label style={{ fontSize: 12, color: "var(--text-2)" }}>Correo<input style={field} value={form.correo} onChange={set("correo")} /></label>
        <label style={{ fontSize: 12, color: "var(--text-2)" }}>Cargo<input style={field} value={form.cargo} onChange={set("cargo")} /></label>
        <label style={{ fontSize: 12, color: "var(--text-2)" }}>Empresa<input style={field} value={form.empresa} onChange={set("empresa")} /></label>
      </div>
      <button type="button" onClick={save} style={{ height: 40, width: 160, borderRadius: 10, background: "#2F6BFF", color: "#fff", fontWeight: 700 }}>Guardar</button>
    </div>
  );
}
