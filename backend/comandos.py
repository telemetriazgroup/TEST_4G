"""
Constructor y detección de ventanas TX (comandos.md).

Sin I/O. El envío y la cola viven en main.py.
"""

from __future__ import annotations

import json
import re
from typing import Any

from homologate import split_json_objects

TX_BUDGET_S = 3.5
COMMAND_TTL_S = 2 * 3600
IDENT_DEFAULT = "POLLO_BEBE"

RELAY_DATA_RE = re.compile(r"^RELAY(\d+)_DATA:", re.IGNORECASE)
INFO_RE = re.compile(r"^INFO:", re.IGNORECASE)
GET_RE = re.compile(r"_GET_", re.IGNORECASE)

# UI v1 — set points seguros
MP5000_FIELDS: list[dict[str, Any]] = [
    {"idx": 0, "key": "setpoint_c", "label": "Setpoint de temperatura", "unit": "°C", "fp": 100, "kind": "setpoint",
     "help": "Valor en °C reales. El gateway multiplica ×100. Acepta negativos (frío). Actual: pantalla INFO o 82A701.",
     "sources": ["info.setpoint_c", "mp5000.setpoint_c"]},
    {"idx": 1, "key": "defrost_term_c", "label": "Fin de deshielo", "unit": "°C", "fp": 100, "kind": "setpoint",
     "help": "Temperatura de corte de defrost. ×100 en el bus.",
     "sources": ["mp5000.defrost_termination_c"]},
    {"idx": 2, "key": "o2_setpoint", "label": "Setpoint O₂", "unit": "%", "fp": 100, "kind": "setpoint",
     "help": "Consigna de oxígeno. ×100.",
     "sources": ["mp5000.o2_setpoint"]},
    {"idx": 3, "key": "co2_setpoint", "label": "Setpoint CO₂", "unit": "%", "fp": 100, "kind": "setpoint",
     "help": "Consigna de CO₂. Actual: INFO o 82A701.",
     "sources": ["info.co2_setpoint_pct", "mp5000.co2_setpoint"]},
    {"idx": 4, "key": "humidity_setpoint", "label": "Setpoint de humedad (idx 4)", "unit": "%", "fp": 100, "kind": "setpoint",
     "help": "Humedad ×100. El idx 35 exige rhCtrl ON; en v1 usamos el 4. Actual: INFO / RELAY.",
     "sources": ["info.humidity_setpoint_pct", "relay.humidity_setpoint_pct"]},
    {"idx": 5, "key": "fae_setpoint", "label": "Renovación de aire", "unit": "cmh", "fp": 1, "kind": "setpoint",
     "help": "Caudal de aire fresco. fp=1 (no ×100).",
     "sources": ["mp5000.fae_rate"]},
    {"idx": 6, "key": "defrost_interval_s", "label": "Intervalo de deshielo", "unit": "s", "fp": 1, "kind": "setpoint",
     "help": "Segundos entre deshielos. Ejemplo 21600 = 6 h.",
     "sources": ["mp5000.defrost_interval_s"]},
    {"idx": 23, "key": "water_cooled", "label": "Condensador agua", "unit": "0/1", "fp": 1, "kind": "setpoint",
     "help": "0 = OFF, 1 = ON.",
     "sources": ["mp5000.water_cooled"]},
    {"idx": 26, "key": "ack_alarm", "label": "Reconocer alarma nº", "unit": "nº", "fp": 1, "kind": "setpoint",
     "help": "Número de alarma a acusar. Actual: lista de alarmas del MP-5000.",
     "sources": ["mp5000.alarm_number"]},
    {"idx": 29, "key": "turn_on", "label": "Encender / apagar unidad", "unit": "0/1", "fp": 1, "kind": "setpoint",
     "help": "Botón frontal. 1 = ON, 0 = OFF.",
     "sources": ["mp5000.unit_active"]},
]

MP5000_ACTIONS: list[dict[str, Any]] = [
    {"idx": 21, "key": "start_defrost", "label": "Iniciar deshielo", "confirm": True,
     "help": "Acción sin parámetro en la hoja. Se envía Trama_Write(21,1,1). Confirmar antes."},
    {"idx": 24, "key": "goto_normal", "label": "Volver a operación normal", "confirm": True,
     "help": "GoTo Normal Operation. Trama_Write(24,1,1)."},
    {"idx": 30, "key": "pause_s", "label": "Pausar unidad (segundos)", "unit": "s", "fp": 1, "confirm": True,
     "help": "Pause / stop machinery. Valor = segundos (ej. 300)."},
]

FORBIDDEN_IDX = {7, 27, 28, 34}


def rs_tag(rs: str) -> str:
    raw = str(rs or "").strip()
    return raw.split(":", 1)[0] if raw else ""


def classify_window(text: str) -> str | None:
    """
    close | V1 | V2 | None
    Última etiqueta relevante del chunk (GET cierra; DATA/INFO abren).
    """
    result = None
    for obj in split_json_objects(str(text or "")):
        rs = obj.get("rs")
        if not isinstance(rs, str) or not rs.strip():
            continue
        tag = rs_tag(rs).upper()
        if GET_RE.search(tag):
            result = "close"
            continue
        if RELAY_DATA_RE.match(rs.strip()):
            result = "V1"
        elif INFO_RE.match(rs.strip()):
            result = "V2"
    return result


def build_mp5000(idx: int, value: Any, fp: int | None = None, ident: str = IDENT_DEFAULT) -> dict[str, Any]:
    if idx in FORBIDDEN_IDX:
        raise ValueError(f"índice {idx} es internal use only")
    if idx < 0 or idx > 38:
        raise ValueError("idx debe estar entre 0 y 38")
    spec = next((f for f in MP5000_FIELDS + MP5000_ACTIONS if f["idx"] == idx), None)
    use_fp = int(fp if fp is not None else (spec or {}).get("fp") or 1)
    if spec and spec.get("kind") != "setpoint" and "fp" not in spec:
        use_fp = int(fp or 1)
        value = 1 if value in (None, "") else value
    try:
        num = float(value)
    except (TypeError, ValueError) as e:
        raise ValueError("valor numérico requerido") from e
    if use_fp == 1 and float(num).is_integer():
        val_txt = str(int(num))
    else:
        val_txt = ("%g" % num)
    rs = f"MP5000_Trama_Write({idx},{val_txt},{use_fp})"
    scaled = num * use_fp
    return {
        "kind": "mp5000_write",
        "i": ident,
        "rs": rs,
        "payload": {"i": ident, "rs": rs},
        "idx": idx,
        "value": num,
        "fp": use_fp,
        "scaled": scaled,
        "label": (spec or {}).get("label") or f"MP5000 idx {idx}",
        "unit": (spec or {}).get("unit"),
    }


def build_relay_string(bits: list[int] | str) -> str:
    if isinstance(bits, str):
        raw = re.sub(r"\s+", "", bits)
        if len(raw) != 10 or any(ch not in "01" for ch in raw):
            raise ValueError("SET_RELE requiere 10 dígitos 0/1")
        return raw
    if len(bits) != 10:
        raise ValueError("se necesitan 10 relés")
    out = []
    for b in bits:
        if b not in (0, 1):
            raise ValueError("cada relé es 0 (ON) o 1 (OFF)")
        out.append(str(int(b)))
    return "".join(out)


def build_relay(bits: list[int] | str, ident: str = IDENT_DEFAULT, node: int = 1) -> dict[str, Any]:
    s = build_relay_string(bits)
    rs = f"RELAY{node:03d}_SET_RELE({s})_"
    on = [i + 1 for i, ch in enumerate(s) if ch == "0"]
    return {
        "kind": "relay_set",
        "i": ident,
        "rs": rs,
        "payload": {"i": ident, "rs": rs},
        "bits": s,
        "relays_on": on,
        "label": f"Relés ON: {on or 'ninguno'}",
    }


def build_pot(n: int, ident: str = IDENT_DEFAULT, node: int = 1) -> dict[str, Any]:
    n = int(n)
    if n < 0 or n > 1000:
        raise ValueError("SET_POT es 0..1000 (décimas de %)")
    rs = f"RELAY{node:03d}_SET_POT({n})_"
    pct = n / 10.0
    volts = n / 100.0
    return {
        "kind": "relay_pot",
        "i": ident,
        "rs": rs,
        "payload": {"i": ident, "rs": rs},
        "n": n,
        "pct": pct,
        "volts": volts,
        "label": f"Pot {pct:.1f}% ({volts:.2f} V)",
    }


def encode_line(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\r\n"


def current_from_seguimiento(latest_by_kind: dict[str, Any] | None) -> dict[str, Any]:
    by = latest_by_kind or {}
    info = (by.get("info") or {}).get("snapshot") or {}
    relay = by.get("relay") or {}
    rsnap = relay.get("snapshot") or {}
    unit = by.get("mp5000") or {}
    usnap = unit.get("snapshot") or {}
    ctrl = unit.get("control") or {}
    return {
        "setpoint_c": info.get("setpoint_c") if info.get("setpoint_c") is not None else usnap.get("setpoint_c"),
        "defrost_term_c": (ctrl.get("defrost_termination_temp") or {}).get("value"),
        "o2_setpoint": (ctrl.get("setpoint_o2") or {}).get("value"),
        "co2_setpoint": info.get("co2_setpoint_pct") if info.get("co2_setpoint_pct") is not None else (ctrl.get("setpoint_co2") or {}).get("value"),
        "humidity_setpoint": info.get("humidity_setpoint_pct") if info.get("humidity_setpoint_pct") is not None else rsnap.get("humidity_setpoint_pct"),
        "humidity_pct": info.get("humidity_pct") if info.get("humidity_pct") is not None else rsnap.get("humidity_pct"),
        "fae_rate": (ctrl.get("fresh_air_exchange_rate") or {}).get("value"),
        "defrost_interval_s": ctrl.get("defrost_interval_h") * 3600 if isinstance(ctrl.get("defrost_interval_h"), (int, float)) else None,
        "water_cooled": 1 if ctrl.get("water_cooled_condenser") else (0 if ctrl.get("water_cooled_condenser") is False else None),
        "unit_active": 1 if usnap.get("unit_active") else (0 if usnap.get("unit_active") is False else None),
        "alarm_number": ((usnap.get("alarms") or [{}])[0].get("number") if usnap.get("alarms") else None),
        "supply_air_c": info.get("supply_air_c") if info.get("supply_air_c") is not None else usnap.get("supply_air_c"),
        "return_air_c": info.get("return_air_c") if info.get("return_air_c") is not None else usnap.get("return_air_c"),
        "relays": relay.get("relays") or [],
        "analogs": relay.get("analogs") or [],
        "container_id": usnap.get("container_id") or unit.get("container_id"),
        "unit_mode": usnap.get("unit_mode"),
    }


def catalog(latest_by_kind: dict[str, Any] | None = None, relay_names: dict[Any, Any] | None = None) -> dict[str, Any]:
    cur = current_from_seguimiento(latest_by_kind)
    fields = []
    for spec in MP5000_FIELDS:
        fields.append({**spec, "current": cur.get(spec["key"])})
    actions = list(MP5000_ACTIONS)
    relays = cur.get("relays") or []
    names = {int(k): v for k, v in (relay_names or {}).items()} if relay_names else {}
    relay_rows = []
    for i in range(1, 11):
        found = next((r for r in relays if r.get("id") == i), None)
        name = (found or {}).get("name") or names.get(i) or "libre"
        on = (found or {}).get("on")
        raw = (found or {}).get("raw")
        relay_rows.append({"id": i, "name": name, "on": on, "raw": raw, "off_bit": 0 if on else 1})
    return {
        "fields": fields,
        "actions": actions,
        "relays": relay_rows,
        "analogs": cur.get("analogs") or [],
        "screen": {
            "supply_air_c": cur.get("supply_air_c"),
            "return_air_c": cur.get("return_air_c"),
            "setpoint_c": cur.get("setpoint_c"),
            "humidity_pct": cur.get("humidity_pct"),
            "humidity_setpoint": cur.get("humidity_setpoint"),
            "container_id": cur.get("container_id"),
            "unit_mode": cur.get("unit_mode"),
        },
    }
