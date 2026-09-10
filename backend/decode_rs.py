"""
Decodifica tramas ASCII POLLO `rs` (INFO y RELAYnnn_DATA).

INFO = lo que se ve en la pantalla local.
RELAY*_DATA = estado de relés y salidas de control.

Nombres de relé: por defecto los de equivalencia2.md; se pueden sobrescribir.
Lógica de relé invertida: 0 = encendido, 1 = apagado.
"""

from __future__ import annotations

import re
from typing import Any

from homologate import split_json_objects

RELAY_DATA_RE = re.compile(r"^RELAY(\d+)_DATA:(.*)$", re.IGNORECASE)
INFO_RE = re.compile(r"^INFO:(.*)$", re.IGNORECASE)

# equivalencia2.md — cámara POLLO_BEBE
DEFAULT_RELAY_NAMES = {
    1: "libre",
    2: "libre",
    3: "renovacion de aire off",
    4: "renovacion de aire on",
    5: "Act on bypass",
    6: "Act off inferior /salida de gases  off",
    7: "Act on inferior /salida de gases   on",
    8: "Act off bypass",
    9: "Aire",
    10: "Agua",
}

INFO_FIELDS = (
    ("supply_air_c", "°C", "Temperatura de suministro"),
    ("return_air_c", "°C", "Temperatura de retorno"),
    ("setpoint_c", "°C", "Setpoint de temperatura"),
    ("usda1_c", "°C", "Sonda USDA 1"),
    ("usda2_c", "°C", "Sonda USDA 2"),
    ("usda3_c", "°C", "Sonda USDA 3"),
    ("usda4_c", "°C", "Sonda USDA 4"),
    ("co2_pct", "%", "CO2 medido"),
    ("humidity_pct", "%", "Humedad relativa"),
    ("co2_setpoint_pct", "%", "Setpoint de CO2"),
    ("humidity_setpoint_pct", "%", "Setpoint de humedad"),
)

ANALOG_FIELDS = (
    ("pot1", "Salida analógica 1"),
    ("pot2", "Salida analógica 2"),
    ("pot3", "Salida analógica 3"),
    ("pot4", "Salida analógica 4"),
)


def looks_rs_text(text: str) -> bool:
    raw = str(text or "").upper()
    return "INFO:" in raw or bool(re.search(r"RELAY\d+_DATA:", raw))


def merge_relay_names(custom: dict[Any, Any] | None = None) -> dict[int, str]:
    names = dict(DEFAULT_RELAY_NAMES)
    if not custom:
        return names
    for key, value in custom.items():
        try:
            idx = int(key)
        except (TypeError, ValueError):
            continue
        if 1 <= idx <= 10 and value is not None and str(value).strip():
            names[idx] = str(value).strip()
    return names


def _floats(raw: str) -> list[float | None]:
    out: list[float | None] = []
    for part in str(raw or "").split(","):
        part = part.strip()
        if not part:
            continue
        try:
            out.append(float(part))
        except ValueError:
            out.append(None)
    return out


def _num(value: float | None, unit: str, label: str) -> dict[str, Any]:
    return {"value": value, "unit": unit, "label": label, "status": "ok" if value is not None else "missing"}


def decode_info(body: str, *, ident: str | None = None) -> dict[str, Any]:
    vals = _floats(body)
    screen: dict[str, Any] = {}
    for i, (key, unit, label) in enumerate(INFO_FIELDS):
        raw = vals[i] if i < len(vals) else None
        screen[key] = _num(raw, unit, label)
    return {
        "kind": "info",
        "source": "INFO",
        "i": ident,
        "field_count": len(vals),
        "screen": screen,
        "snapshot": {
            "supply_air_c": screen["supply_air_c"]["value"],
            "return_air_c": screen["return_air_c"]["value"],
            "setpoint_c": screen["setpoint_c"]["value"],
            "usda1_c": screen["usda1_c"]["value"],
            "usda2_c": screen["usda2_c"]["value"],
            "usda3_c": screen["usda3_c"]["value"],
            "usda4_c": screen["usda4_c"]["value"],
            "co2_pct": screen["co2_pct"]["value"],
            "humidity_pct": screen["humidity_pct"]["value"],
            "co2_setpoint_pct": screen["co2_setpoint_pct"]["value"],
            "humidity_setpoint_pct": screen["humidity_setpoint_pct"]["value"],
        },
    }


def decode_relay(
    body: str,
    *,
    node: int,
    ident: str | None = None,
    relay_names: dict[Any, Any] | None = None,
) -> dict[str, Any]:
    names = merge_relay_names(relay_names)
    text = str(body or "").strip()
    if "," in text:
        left, right = text.split(",", 1)
    else:
        left, right = text, ""
    bits: list[int | None] = []
    for tok in left.split():
        if tok in {"0", "1"}:
            bits.append(int(tok))
    bits = (bits + [None] * 10)[:10]
    analogs_raw = _floats(right)
    relays = []
    for i in range(10):
        raw = bits[i]
        relays.append(
            {
                "id": i + 1,
                "name": names.get(i + 1, "libre"),
                "raw": raw,
                "on": raw == 0 if raw in (0, 1) else None,
                "off": raw == 1 if raw in (0, 1) else None,
            }
        )
    analogs = []
    for i, (key, label) in enumerate(ANALOG_FIELDS):
        volts = analogs_raw[i] if i < len(analogs_raw) else None
        analogs.append(
            {
                "id": i + 1,
                "key": key,
                "label": label,
                "volts": volts,
                "speed_pct": None if volts is None else round(volts * 10, 1),
                "unit": "V",
            }
        )
    humidity = analogs_raw[4] if len(analogs_raw) > 4 else None
    humidity_sp = analogs_raw[5] if len(analogs_raw) > 5 else None
    on_names = [r["name"] for r in relays if r.get("on")]
    return {
        "kind": "relay",
        "source": f"RELAY{node:03d}_DATA",
        "node": node,
        "i": ident,
        "relays": relays,
        "analogs": analogs,
        "humidity_pct": humidity,
        "humidity_setpoint_pct": humidity_sp,
        "snapshot": {
            "node": node,
            "relays_on": on_names,
            "humidity_pct": humidity,
            "humidity_setpoint_pct": humidity_sp,
            "pot1_v": analogs[0]["volts"],
            "pot2_v": analogs[1]["volts"],
            "pot3_v": analogs[2]["volts"],
            "pot4_v": analogs[3]["volts"],
        },
    }


def decode_rs_object(obj: dict[str, Any], *, relay_names: dict[Any, Any] | None = None) -> dict[str, Any] | None:
    rs = obj.get("rs")
    if not isinstance(rs, str) or ":" not in rs:
        return None
    ident = str(obj.get("i") or "") or None
    info = INFO_RE.match(rs.strip())
    if info:
        return decode_info(info.group(1), ident=ident)
    relay = RELAY_DATA_RE.match(rs.strip())
    if relay:
        return decode_relay(relay.group(2), node=int(relay.group(1)), ident=ident, relay_names=relay_names)
    return None


def decode_rs_text(text: str, *, relay_names: dict[Any, Any] | None = None, ts: str | None = None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for obj in split_json_objects(str(text or "")):
        decoded = decode_rs_object(obj, relay_names=relay_names)
        if not decoded:
            continue
        if ts:
            decoded["ts"] = ts
        out.append(decoded)
    return out
