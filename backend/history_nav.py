"""Consultas de histórico por día y por hora, de 100 en 100.

El día y la hora se guardan en America/Lima. Un recorte de los primeros
10 caracteres del timestamp UTC deja el archivo del día vacío después de
las 19:00 en Lima, y el addr ip:puerto cambia en cada reconexión.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from homologate import date_key, env_tz, hour_key

PAGE = 100
RECENT_DAYS = 14


def ip_of(addr: str | None) -> str | None:
    raw = (addr or "").strip()
    if not raw or ":" not in raw:
        return raw or None
    host = raw.rsplit(":", 1)[0].strip()
    return host or None


def scope_query(
    *,
    session_id: str | None = None,
    addr: str | None = None,
    ip: str | None = None,
) -> dict[str, Any]:
    """La historia de un equipo es por IP. El puerto TCP de origen cambia."""
    if session_id:
        return {"session_id": session_id}
    host = (ip or "").strip() or ip_of(addr)
    if host:
        return {"ip": host}
    if addr:
        return {"addr": addr}
    return {}


def calendar_fields(ts: str | None) -> dict[str, str]:
    day = date_key(ts)
    hour = hour_key(ts)
    if day == "desconocida":
        return {"day": "desconocida", "hour": "desconocida"}
    return {"day": day, "hour": hour}


def lima_today() -> str:
    now = datetime.now(env_tz())
    return f"{now.year:04d}-{now.month:02d}-{now.day:02d}"


def recent_hour_cutoff() -> str:
    start = datetime.now(env_tz()) - timedelta(days=RECENT_DAYS)
    return f"{start.year:04d}-{start.month:02d}-{start.day:02d} 00:00"


def lima_bounds(date: str | None = None, hour: str | None = None) -> tuple[str, str] | None:
    """Inicio inclusive y fin exclusivo, en UTC, de un día o una hora de Lima."""
    tz = env_tz()
    if hour:
        text = hour.strip()
        if len(text) < 13:
            return None
        start = datetime.strptime(text[:16], "%Y-%m-%d %H:%M").replace(tzinfo=tz)
        end = start + timedelta(hours=1)
    elif date:
        start = datetime.strptime(date.strip(), "%Y-%m-%d").replace(tzinfo=tz)
        end = start + timedelta(days=1)
    else:
        return None
    return (
        start.astimezone(timezone.utc).isoformat(),
        end.astimezone(timezone.utc).isoformat(),
    )


def time_query(*, date: str | None = None, hour: str | None = None) -> dict[str, Any]:
    """Usa el campo indexado y, si aún no está, el rango UTC equivalente."""
    bounds = lima_bounds(date=None if hour else date, hour=hour)
    if hour:
        clause: dict[str, Any] = {"hour": hour}
        field = "hour"
    elif date:
        clause = {"day": date}
        field = "day"
    else:
        return {}
    if not bounds:
        return clause
    start, end = bounds
    return {
        "$or": [
            clause,
            {field: {"$exists": False}, "ts": {"$gte": start, "$lt": end}},
        ]
    }


def extra_filters(
    *,
    direction: str | None = None,
    value_type: str | None = None,
) -> dict[str, Any]:
    q: dict[str, Any] = {}
    if direction in {"rx", "tx"}:
        q["direction"] = direction
    if value_type and value_type != "all":
        q["value_type"] = value_type
    return q


def history_query(
    *,
    session_id: str | None = None,
    addr: str | None = None,
    ip: str | None = None,
    date: str | None = None,
    hour: str | None = None,
    direction: str | None = None,
    value_type: str | None = None,
) -> dict[str, Any]:
    q = scope_query(session_id=session_id, addr=addr, ip=ip)
    q.update(time_query(date=date, hour=hour))
    q.update(extra_filters(direction=direction, value_type=value_type))
    return q


def clamp_page(limit: int, skip: int) -> tuple[int, int]:
    try:
        size = int(limit)
    except (TypeError, ValueError):
        size = PAGE
    try:
        offset = int(skip)
    except (TypeError, ValueError):
        offset = 0
    return max(1, min(size, PAGE)), max(0, offset)


def sent_ts_query(date_from: str | None, date_to: str | None) -> dict[str, Any]:
    start = lima_bounds(date_from)[0] if date_from else None
    end = lima_bounds(date_to)[1] if date_to else None
    if not start and not end:
        return {}
    window: dict[str, str] = {}
    if start:
        window["$gte"] = start
    if end:
        window["$lt"] = end
    return {"ts": window}
