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
};

const API = import.meta.env.VITE_API_URL ?? "";
export const SERIAL_URL = import.meta.env.VITE_SERIAL_URL || "http://localhost:8091";

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

export async function fetchSeries(hours: number, ident = "POLLO_BEBE"): Promise<SeriesPoint[]> {
  const r = await fetch(`${API}/api/client/series?ident=${encodeURIComponent(ident)}&hours=${hours}`);
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
