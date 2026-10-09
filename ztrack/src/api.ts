export type Role = "admin" | "monitor" | "superadmin";

export type Zone = { id: number; temp: number | null };
export type Motor = { id: number; label: string; volts: number | null; speed_pct: number | null };
export type RelayRef = { id: number; name: string; on: boolean | null };

export type LiveSnapshot = {
  ident: string;
  online: boolean;
  stale: boolean;
  age_s: number | null;
  ts: string | null;
  supply_air_c: number | null;
  return_air_c: number | null;
  setpoint_c: number | null;
  humidity_pct: number | null;
  humidity_setpoint_pct: number | null;
  co2_pct: number | null;
  co2_setpoint_pct: number | null;
  zones: Zone[];
  motors: Motor[];
  ventilation_pct: number | null;
  relays: RelayRef[];
  alarm_present?: boolean;
  ip?: string | null;
  addr?: string | null;
};

export type SeriesPoint = {
  ts: string;
  supply_air_c: number | null;
  return_air_c: number | null;
  setpoint_c: number | null;
  humidity_pct: number | null;
  co2_pct: number | null;
  usda1_c: number | null;
  usda2_c: number | null;
  usda3_c: number | null;
  usda4_c: number | null;
};

export type Session = {
  role: Role;
  name: string;
  username: string;
  ident: string;
  nombre?: string;
  apellido?: string;
  correo?: string;
  cargo?: string;
  empresa?: string;
};

export type Profile = {
  username: string;
  name: string;
  nombre: string;
  apellido: string;
  correo: string;
  cargo: string;
  empresa: string;
  role: string;
};

const API = import.meta.env.VITE_API_URL ?? "";

/** Mismo host con el que se abrió Ztrack. No manda a localhost si entraron por la IP del servidor. */
export function serialUrl(): string {
  const fallback = (import.meta.env.VITE_SERIAL_URL as string) || "http://localhost:8089";
  if (typeof window === "undefined") return fallback;
  const host = window.location.hostname;
  if (!host || host === "localhost" || host === "127.0.0.1") return fallback;
  const proto = window.location.protocol || "http:";
  return `${proto}//${host}:8089`;
}

export const SERIAL_URL = serialUrl();

export async function clientLogin(username: string, password: string): Promise<Session> {
  const r = await fetch(`${API}/api/client/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || "No se pudo iniciar sesión");
  return data as Session;
}

export async function fetchLive(ident = "POLLO_BEBE"): Promise<LiveSnapshot> {
  const r = await fetch(`${API}/api/client/live?ident=${encodeURIComponent(ident)}`);
  if (!r.ok) throw new Error("No se pudo leer el estado");
  return r.json();
}

export type ClientUser = { username: string; name: string; role: Role | "superadmin" };
export type ZoneRange = { id: number; min: number; max: number };

export async function fetchUsers(): Promise<ClientUser[]> {
  const r = await fetch(`${API}/api/client/users`);
  if (!r.ok) throw new Error("No se pudieron leer los usuarios");
  const data = await r.json();
  return data.users || [];
}

export async function createUser(body: { username: string; password: string; role: string; name: string }) {
  const r = await fetch(`${API}/api/client/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || "No se pudo crear el usuario");
  return data;
}

export async function changePassword(username: string, password: string, nextPassword: string) {
  const r = await fetch(`${API}/api/client/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, next_password: nextPassword }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || "No se pudo cambiar la contraseña");
  return data;
}

export async function fetchRanges(ident = "POLLO_BEBE"): Promise<ZoneRange[]> {
  const r = await fetch(`${API}/api/client/ranges?ident=${encodeURIComponent(ident)}`);
  if (!r.ok) throw new Error("No se pudieron leer los rangos");
  const data = await r.json();
  return data.zones || [];
}

export async function saveRanges(ident: string, zones: ZoneRange[]) {
  const r = await fetch(`${API}/api/client/ranges`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ident, zones }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || "No se pudieron guardar los rangos");
  return data;
}

export async function fetchCommandCatalog(ident = "POLLO_BEBE") {
  const r = await fetch(`${API}/api/comandos/catalog?ident=${encodeURIComponent(ident)}`);
  if (!r.ok) throw new Error("No se pudo leer el catálogo de comandos");
  return r.json();
}

export type CommandHistoryItem = {
  queue_id?: string;
  ts?: string;
  enqueued_at?: string;
  sent_at?: string | null;
  status?: string;
  reason?: string | null;
  kind?: string;
  origin?: string;
  label?: string | null;
  expected?: string | number | null;
  i?: string;
  ip?: string | null;
  username?: string | null;
  session_id?: string | null;
};

export async function fetchCommandHistory(ident = "POLLO_BEBE", tipo = "all", limit = 300) {
  const q = new URLSearchParams({ ident, limit: String(limit) });
  if (tipo && tipo !== "all") q.set("tipo", tipo);
  const r = await fetch(`${API}/api/comandos/sent?${q}`);
  if (!r.ok) throw new Error("No se pudo leer el historial");
  const data = await r.json();
  return (data.items || []) as CommandHistoryItem[];
}

export async function enqueueCommand(body: Record<string, unknown>) {
  const r = await fetch(`${API}/api/comandos/enqueue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || "No se pudo encolar el comando");
  return data;
}

export async function fetchProfile(username: string): Promise<Profile> {
  const r = await fetch(`${API}/api/client/profile?username=${encodeURIComponent(username)}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || "No se pudo leer el perfil");
  return data;
}

export async function saveProfile(body: Profile) {
  const r = await fetch(`${API}/api/client/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || "No se pudo guardar el perfil");
  return data.user as Profile;
}

export async function fetchRuleCatalog(ident = "POLLO_BEBE") {
  const r = await fetch(`${API}/api/reglas/catalog?ident=${encodeURIComponent(ident)}`);
  if (!r.ok) throw new Error("No se pudo leer el catálogo de reglas");
  return r.json();
}

export async function fetchPrograms(ident = "POLLO_BEBE") {
  const r = await fetch(`${API}/api/reglas/programas?ident=${encodeURIComponent(ident)}`);
  if (!r.ok) throw new Error("No se pudieron leer las reglas");
  const data = await r.json();
  return data.programas || [];
}

export async function saveProgram(body: { ident: string; name: string; reglas: unknown[]; username: string }) {
  const r = await fetch(`${API}/api/reglas/programas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || "No se pudo guardar la regla");
  return data;
}

export async function deleteProgram(id: string) {
  const r = await fetch(`${API}/api/reglas/programas/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || "No se pudo borrar la regla");
  return data;
}

export async function fetchSeries(
  hours: number,
  ident = "POLLO_BEBE",
  start?: string,
  end?: string,
): Promise<SeriesPoint[]> {
  const p = new URLSearchParams({ ident, hours: String(hours) });
  if (start) p.set("start", start);
  if (end) p.set("end", end);
  const r = await fetch(`${API}/api/client/series?${p.toString()}`);
  if (!r.ok) throw new Error("No se pudo leer la serie");
  const data = await r.json();
  return data.points || [];
}

export async function applySetpoints(body: {
  ident?: string;
  temperature_c?: number;
  humidity_pct?: number;
  co2_pct?: number;
}) {
  const r = await fetch(`${API}/api/client/setpoints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || "No se pudieron encolar las consignas");
  return data;
}

export function seriesField(points: SeriesPoint[], key: keyof SeriesPoint, fallback: number | null): number[] {
  const vals = points.map((p) => p[key]).filter((v): v is number => typeof v === "number");
  if (vals.length) return vals;
  return fallback == null ? [] : [fallback];
}
