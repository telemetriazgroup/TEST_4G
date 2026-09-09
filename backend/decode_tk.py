"""
Decodifica bloques MP-5000 82A70x (d01..d05) a JSON de estado.

Mismo envoltorio y CRC que proceso_82A700.md. El opcode (82A7 + subreply)
identifica el dataset; no se usa el nombre d0x.
"""

from __future__ import annotations

import json
from typing import Any

from homologate import index_opcodes, split_json_objects

SPECIAL = {
    0x7FFF: "initializing",
    0x7FFE: "na",
    0x7FFD: "error",
    0x7FFC: "open",
    0x7FFB: "short",
    0x7FFA: "above",
    0x7FF9: "below",
    0x7FF8: "no_comm",
    0x7FF7: "warmup",
}

# Manual §5.1
UNIT_MODES = {
    0: "chilled",
    1: "frozen",
    2: "stop",
    3: "defrost_begin",
    4: "defrost_ended",
    5: "function_test_begin",
    6: "function_test",
    7: "brief_pti_begin",
    8: "chill_pti_begin",
    9: "afam_pti_begin",
    10: "rh_pti_begin",
    11: "pti_begin",
    12: "pti",
    13: "manual_function_test_begin",
    14: "manual_function_test",
    15: "runtime_probe_test",
    16: "auto_unit_test",
    17: "unit_autoconfiguration",
    18: "external_test_begin",
    19: "external_test",
    20: "shutdown_begin",
    21: "shutdown",
    22: "shutdown_end",
    23: "pti_chill_pulldown",
    24: "pti_chill_maintaining",
    25: "pti_defrosting",
    26: "pti_frozen_pulldown",
    27: "pti_ended_failed",
    28: "pti_ended_passed",
}

FAE_MODES = {0: "off", 1: "units", 2: "demand"}
OP_SENSOR, OP_CONTROL, OP_IO, OP_CAPTION, OP_ALARM = (
    "82A700",
    "82A701",
    "82A702",
    "82A703",
    "82A706",
)


def crc16_tk(chunk: bytes) -> int:
    crc = 0
    for serdata in chunk:
        crc = ((crc >> 8) & 0xFF) | ((crc << 8) & 0xFFFF)
        crc ^= serdata
        crc ^= (crc & 0xFF) >> 4
        crc ^= ((crc << 8) << 4) & 0xFFFF
        crc &= 0xFFFF
        crc ^= (((crc & 0xFF) << 4) << 1) & 0xFFFF
        crc &= 0xFFFF
    return crc


def parse_frame(hex_raw: str) -> dict[str, Any] | None:
    hx = "".join(str(hex_raw or "").split()).upper()
    if len(hx) < 20 or len(hx) % 2:
        return None
    try:
        raw = bytes.fromhex(hx)
    except ValueError:
        return None
    if raw[:2] != b"\x1b\x02" or raw[-2:] != b"\x1b\x04" or len(raw) < 12:
        return None
    stored = raw[-4:-2]
    calc = crc16_tk(raw[2:-4])
    crc_ok = bytes([(calc >> 8) & 0xFF, calc & 0xFF]) == stored
    opcode = raw[5:8].hex().upper()
    return {
        "raw": raw,
        "opcode": opcode,
        "data": raw[8:-4],
        "crc": stored.hex().upper(),
        "crc_ok": crc_ok,
    }


def _u16(data: bytes, off: int) -> int | None:
    if off + 2 > len(data):
        return None
    return int.from_bytes(data[off : off + 2], "little", signed=False)


def _i16(data: bytes, off: int) -> int | None:
    if off + 2 > len(data):
        return None
    return int.from_bytes(data[off : off + 2], "little", signed=True)


def _u32(data: bytes, off: int) -> int | None:
    if off + 4 > len(data):
        return None
    return int.from_bytes(data[off : off + 4], "little", signed=False)


def decode_fp(raw: int | None, exp: int, unit: str = "") -> dict[str, Any]:
    if raw is None:
        return {"value": None, "status": "missing", "unit": unit, "raw": None}
    u = raw & 0xFFFF
    if u >= 0x7FF0:
        return {
            "value": None,
            "status": SPECIAL.get(u, "reserved"),
            "unit": unit,
            "raw": u,
        }
    signed = u - 0x10000 if u >= 0x8000 else u
    value = signed * (10**exp)
    if exp < 0:
        value = round(value, -exp)
    return {"value": value, "status": "ok", "unit": unit, "raw": u}


def io_flag(b: int | None) -> dict[str, Any]:
    if b is None:
        return {"value": None, "status": "missing"}
    if b == 0xFF:
        return {"value": None, "status": "unused", "raw": b}
    return {"value": bool(b), "status": "ok", "raw": b}


def decode_82a700(data: bytes) -> dict[str, Any]:
    fields_16 = [
        (0, "supply1_air_temp", -1, "°C"),
        (2, "supply2_air_temp", -1, "°C"),
        (4, "return_air_temp", -1, "°C"),
        (6, "evaporator1_coil_temp", -1, "°C"),
        (8, "condenser_coil_temp", -1, "°C"),
        (10, "compressor_coil_temp", -1, "°C"),
        (12, "compressor2_coil_temp", -1, "°C"),
        (14, "ambient_air_temp", -1, "°C"),
        (16, "cargo1_temp", -1, "°C"),
        (18, "cargo2_temp", -1, "°C"),
        (20, "cargo3_temp", -1, "°C"),
        (22, "cargo4_temp", -1, "°C"),
        (24, "relative_humidity", 0, "%"),
        (26, "avlv", 0, "CMH"),
        (28, "suction_pressure", -2, "bar"),
        (30, "discharge_pressure", -2, "bar"),
        (32, "line_voltage", -1, "V"),
        (34, "line_frequency", 0, "Hz"),
        (36, "current_ph1", -1, "A"),
        (38, "current_ph2", -1, "A"),
        (40, "current_ph3", -1, "A"),
        (42, "co2", -1, "%"),
        (44, "o2", -1, "%"),
        (46, "evaporator_fan_speed", 0, "%"),
        (48, "condenser_fan_speed", 0, "%"),
        (50, "datalogger_battery_voltage", -1, "V"),
    ]
    out: dict[str, Any] = {}
    for off, name, exp, unit in fields_16:
        out[name] = decode_fp(_u16(data, off), exp, unit)
    for off, name, exp, unit in (
        (52, "power_meter_reading", -1, "kWh"),
        (56, "power_meter_trip_reading", -1, "kWh"),
    ):
        raw32 = _u32(data, off)
        out[name] = (
            {"value": raw32 * (10**exp), "status": "ok", "unit": unit, "raw": raw32}
            if raw32 is not None
            else decode_fp(None, exp, unit)
        )
    dur = _u32(data, 60)
    out["power_meter_trip_duration"] = (
        {"value": dur, "status": "ok", "unit": "s", "raw": dur}
        if dur is not None
        else {"value": None, "status": "missing", "unit": "s"}
    )
    for off, name, exp, unit in (
        (64, "suction_temp", -1, "°C"),
        (66, "discharge_temp", -1, "°C"),
        (68, "supply_air_temp_showoff", -1, "°C"),
        (70, "return_air_temp_showoff", -1, "°C"),
        (72, "dl_battery_temp", -2, "°C"),
        (74, "dl_battery_charge_current", -2, "A"),
        (76, "power_consumption", -2, "kWh"),
        (78, "power_consumption_avg_per_hour", -2, "kWh"),
        (80, "suction2_pressure", -2, "bar"),
        (82, "suction2_temp", -1, "°C"),
    ):
        out[name] = decode_fp(_u16(data, off), exp, unit)
    return out


def decode_82a701(data: bytes) -> dict[str, Any]:
    alarm_n = _u16(data, 0) or 0
    pwr = data[6] if len(data) > 6 else 0
    mode = data[7] if len(data) > 7 else None
    hum_c = data[8] if len(data) > 8 else None
    fae = data[10] if len(data) > 10 else None
    valves = []
    for off, name in (
        (24, "evaporator_expansion"),
        (25, "suction_modulation"),
        (26, "hot_gas"),
        (27, "economizer"),
    ):
        b = data[off] if len(data) > off else None
        if b is None:
            valves.append({"name": name, "value": None, "status": "missing"})
        elif b == 0xFF:
            valves.append({"name": name, "value": None, "status": "unused", "unit": "%"})
        else:
            valves.append({"name": name, "value": b, "status": "ok", "unit": "%"})
    return {
        "alarm_present": bool(alarm_n),
        "temperature_setpoint": decode_fp(_u16(data, 2), -2, "°C"),
        "capacity_load": decode_fp(_u16(data, 4), 0, "%"),
        "power": {
            "raw": pwr,
            "ac_connected": bool(pwr & 0x01),
            "unit_active": bool(pwr & 0x02),
        },
        "unit_mode": {
            "id": mode,
            "name": UNIT_MODES.get(mode, "unknown") if mode is not None else None,
        },
        "humidity_control": {0: "off", 1: "dehum"}.get(hum_c, hum_c),
        "humidity_setpoint": {"value": data[9], "unit": "%", "status": "ok"}
        if len(data) > 9
        else {"value": None, "status": "missing", "unit": "%"},
        "fresh_air_exchange_mode": FAE_MODES.get(fae, fae),
        "fresh_air_exchange_rate": decode_fp(_u16(data, 11), 0, "CMH"),
        "fresh_air_exchange_delay": decode_fp(_u16(data, 13), -1, "h"),
        "setpoint_o2": decode_fp(_u16(data, 15), -1, "%"),
        "setpoint_co2": decode_fp(_u16(data, 17), -1, "%"),
        "defrost_termination_temp": decode_fp(_u16(data, 19), -2, "°C"),
        "defrost_interval_h": data[21] if len(data) > 21 else None,
        "water_cooled_condenser": bool(data[22]) if len(data) > 22 else None,
        "usda_trip": bool(data[23]) if len(data) > 23 else None,
        "valves": valves,
    }


def decode_82a702(data: bytes) -> dict[str, Any]:
    names = [
        "di_lpco",
        "di_hpco",
        "do_economizer_valve",
        "do_digital_valve",
        "do_heater",
        "do_compressor",
        "do_evaporator_high",
        "do_evaporator_low",
        "do_condenser_fan",
        "phase_relay_1",
        "phase_relay_2",
    ]
    io = {n: io_flag(data[i] if i < len(data) else None) for i, n in enumerate(names)}
    extra = list(data[11:]) if len(data) > 11 else []
    return {"points": io, "extra": extra}


def decode_82a703(data: bytes) -> dict[str, Any]:
    text = data.decode("ascii", errors="replace").split("\x00", 1)[0].strip()
    return {"container_id": text, "raw_ascii": text}


def decode_alarm_word(u: int) -> dict[str, Any] | None:
    if u in (0, 0xFFFF):
        return None
    return {
        "number": u & 0x0FFF,
        "group": (u >> 12) & 0x07,
        "acknowledged": bool(u & 0x8000),
        "raw": u,
    }


def decode_82a706(data: bytes) -> dict[str, Any]:
    present = _u16(data, 0) or 0
    alarms = []
    for i in range(10):
        word = _u16(data, 2 + i * 2)
        if word is None:
            break
        parsed = decode_alarm_word(word)
        if parsed:
            parsed["slot"] = i + 1
            alarms.append(parsed)
    return {"alarm_present": bool(present), "count": len(alarms), "alarms": alarms}


DECODERS = {
    OP_SENSOR: ("sensors", decode_82a700),
    OP_CONTROL: ("control", decode_82a701),
    OP_IO: ("io", decode_82a702),
    OP_CAPTION: ("caption", decode_82a703),
    OP_ALARM: ("alarms", decode_82a706),
}


def decode_hex_block(hex_raw: str) -> dict[str, Any] | None:
    frame = parse_frame(hex_raw)
    if not frame:
        return None
    kind_fn = DECODERS.get(frame["opcode"])
    out: dict[str, Any] = {
        "opcode": frame["opcode"],
        "crc_ok": frame["crc_ok"],
        "crc": frame["crc"],
        "data_len": len(frame["data"]),
    }
    if kind_fn:
        out["kind"] = kind_fn[0]
        if frame["crc_ok"]:
            out[kind_fn[0]] = kind_fn[1](frame["data"])
        else:
            out["error"] = "crc_mismatch"
    else:
        out["kind"] = "unknown"
    return out


def decode_unit_status(text_or_obj: Any, *, ident: str | None = None, ts: str | None = None) -> dict[str, Any] | None:
    """Arma el estado del equipo a partir de un JSON POLLO (o texto con }{)."""
    objs: list[dict[str, Any]]
    if isinstance(text_or_obj, dict):
        objs = [text_or_obj]
    else:
        objs = split_json_objects(str(text_or_obj or ""))
    data_obj = next((o for o in objs if any(str(k).lower().startswith("d") for k in o)), None)
    if not data_obj:
        return None
    ident = ident or str(data_obj.get("i") or "")
    by_op = index_opcodes(data_obj)
    blocks: dict[str, Any] = {}
    merged: dict[str, Any] = {
        "i": ident,
        "ts": ts,
        "crc_all_ok": True,
        "opcodes": sorted(by_op.keys()),
        "blocks": blocks,
    }
    for op, hexv in by_op.items():
        decoded = decode_hex_block(hexv)
        if not decoded:
            continue
        blocks[op] = decoded
        if not decoded.get("crc_ok", False):
            merged["crc_all_ok"] = False
        kind = decoded.get("kind")
        if kind and kind in decoded:
            merged[kind] = decoded[kind]
    if not blocks:
        return None
    ctrl = merged.get("control") or {}
    alm = merged.get("alarms") or {}
    cap = merged.get("caption") or {}
    sens = merged.get("sensors") or {}
    merged["snapshot"] = {
        "container_id": cap.get("container_id"),
        "unit_mode": (ctrl.get("unit_mode") or {}).get("name"),
        "unit_mode_id": (ctrl.get("unit_mode") or {}).get("id"),
        "setpoint_c": (ctrl.get("temperature_setpoint") or {}).get("value"),
        "capacity_load_pct": (ctrl.get("capacity_load") or {}).get("value"),
        "ac_connected": (ctrl.get("power") or {}).get("ac_connected"),
        "unit_active": (ctrl.get("power") or {}).get("unit_active"),
        "alarm_present": bool(ctrl.get("alarm_present") or alm.get("alarm_present")),
        "alarms": alm.get("alarms") or [],
        "supply_air_c": (sens.get("supply1_air_temp") or {}).get("value"),
        "return_air_c": (sens.get("return_air_temp") or {}).get("value"),
        "ambient_c": (sens.get("ambient_air_temp") or {}).get("value"),
        "humidity_pct": (sens.get("relative_humidity") or {}).get("value"),
    }
    return merged


def decode_any(raw: str) -> list[dict[str, Any]]:
    """Acepta JSON POLLO, objeto con text, o lista de mensajes del histórico."""
    raw = (raw or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = None
    out: list[dict[str, Any]] = []

    def _from_item(item: Any) -> None:
        if isinstance(item, dict):
            st = decode_unit_status(item.get("text") or item, ts=item.get("ts"))
        else:
            st = decode_unit_status(item)
        if st:
            out.append(st)

    if isinstance(parsed, list):
        for item in parsed:
            _from_item(item)
    elif isinstance(parsed, dict):
        rows = parsed.get("frames") or parsed.get("items") or parsed.get("history")
        if isinstance(rows, list):
            for item in rows:
                _from_item(item)
        else:
            _from_item(parsed)
    else:
        st = decode_unit_status(raw)
        if st:
            out.append(st)
    return out


if __name__ == "__main__":
    import sys

    src = sys.stdin.read() if len(sys.argv) < 2 else open(sys.argv[1], encoding="utf-8").read()
    rows = decode_any(src)
    if not rows:
        print("{}", file=sys.stderr)
        sys.exit(1)
    json.dump(rows[0] if len(rows) == 1 else rows, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
