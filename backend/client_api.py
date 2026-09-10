"""
Fachada de negocio para Ztrack (cliente).
Sin hex ni serial. CO₂ en %. Ventilación = 4 motores (analógicas RELAY).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

IDENT_DEFAULT = "POLLO_BEBE"
STALE_S = 60.0


def parse_ts(raw: Any) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    text = str(raw).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _num(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _info_snap(latest: dict[str, Any]) -> dict[str, Any]:
    info = latest.get("info") or {}
    return dict(info.get("snapshot") or {})


def _mp_snap(latest: dict[str, Any]) -> dict[str, Any]:
    mp = latest.get("mp5000") or {}
    return dict(mp.get("snapshot") or {})


def _pick(*values: Any) -> float | None:
    for v in values:
        n = _num(v)
        if n is not None:
            return n
    return None


def _latest_ts(latest: dict[str, Any]) -> datetime | None:
    times: list[datetime] = []
    for kind in ("info", "relay", "mp5000"):
        dt = parse_ts((latest.get(kind) or {}).get("ts"))
        if dt:
            times.append(dt)
    return max(times) if times else None


def build_live(
    latest: dict[str, Any],
    *,
    ident: str = IDENT_DEFAULT,
    online: bool = False,
    names: dict[int, str] | None = None,
) -> dict[str, Any]:
    info = _info_snap(latest)
    mp = _mp_snap(latest)
    relay = latest.get("relay") or {}
    names = names or {}

    supply = _pick(info.get("supply_air_c"), mp.get("supply_air_c"))
    ret = _pick(info.get("return_air_c"), mp.get("return_air_c"))
    sp = _pick(info.get("setpoint_c"), mp.get("setpoint_c"))
    hum = _pick(info.get("humidity_pct"), mp.get("humidity_pct"), relay.get("humidity_pct"))
    hum_sp = _pick(info.get("humidity_setpoint_pct"), relay.get("humidity_setpoint_pct"))
    co2 = _pick(info.get("co2_pct"))
    co2_sp = _pick(info.get("co2_setpoint_pct"))

    zones = []
    for i in range(1, 5):
        zones.append({"id": i, "temp": _pick(info.get(f"usda{i}_c"))})

    motors = []
    for a in relay.get("analogs") or []:
        motors.append(
            {
                "id": a.get("id"),
                "label": f"Motor {a.get('id')}",
                "volts": _pick(a.get("volts")),
                "speed_pct": _pick(a.get("speed_pct")),
            }
        )
    while len(motors) < 4:
        n = len(motors) + 1
        motors.append({"id": n, "label": f"Motor {n}", "volts": None, "speed_pct": None})
    motors = motors[:4]
    speeds = [m["speed_pct"] for m in motors if m["speed_pct"] is not None]
    vent_pct = round(sum(speeds) / len(speeds), 1) if speeds else None

    relays = []
    for r in relay.get("relays") or []:
        rid = int(r.get("id") or 0)
        relays.append(
            {
                "id": rid,
                "name": r.get("name") or names.get(rid) or f"RELAY{rid}",
                "on": r.get("on"),
            }
        )

    ts = _latest_ts(latest)
    now = datetime.now(timezone.utc)
    age_s = None if ts is None else max(0.0, (now - ts).total_seconds())
    stale = age_s is None or age_s >= STALE_S

    return {
        "ident": ident,
        "online": online,
        "stale": stale,
        "age_s": None if age_s is None else round(age_s),
        "ts": ts.isoformat() if ts else None,
        "supply_air_c": supply,
        "return_air_c": ret,
        "setpoint_c": sp,
        "humidity_pct": hum,
        "humidity_setpoint_pct": hum_sp,
        "co2_pct": co2,
        "co2_setpoint_pct": co2_sp,
        "zones": zones,
        "motors": motors,
        "ventilation_pct": vent_pct,
        "relays": relays,
        "alarm_present": bool(mp.get("alarm_present")),
        "phase": 1,
    }


def build_series(rows: list[dict[str, Any]], hours: int = 6) -> dict[str, Any]:
    points: list[dict[str, Any]] = []
    for row in rows:
        snap = row.get("snapshot") or {}
        if row.get("kind") != "info":
            continue
        points.append(
            {
                "ts": row.get("ts"),
                "supply_air_c": _pick(snap.get("supply_air_c")),
                "return_air_c": _pick(snap.get("return_air_c")),
                "setpoint_c": _pick(snap.get("setpoint_c")),
                "humidity_pct": _pick(snap.get("humidity_pct")),
                "co2_pct": _pick(snap.get("co2_pct")),
                "usda1_c": _pick(snap.get("usda1_c")),
                "usda2_c": _pick(snap.get("usda2_c")),
                "usda3_c": _pick(snap.get("usda3_c")),
                "usda4_c": _pick(snap.get("usda4_c")),
            }
        )
    points.sort(key=lambda p: str(p.get("ts") or ""))
    return {"hours": hours, "count": len(points), "points": points}


def series_values(points: list[dict[str, Any]], key: str, fallback: float | None = None) -> list[float]:
    vals = [p[key] for p in points if p.get(key) is not None]
    if vals:
        return [float(v) for v in vals]
    if fallback is not None:
        return [float(fallback)]
    return []
