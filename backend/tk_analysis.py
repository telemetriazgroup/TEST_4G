"""Decodificación inmediata de respuestas MP-4000 / MP-5000 y catálogo de lecturas.

El ciclo de cada minuto sigue usando solo sensores y control. Este módulo
arma el hex de las demás lecturas y las traduce a campos, sin publicar JSON.
"""

from __future__ import annotations

from typing import Any

from decode_tk import (
    crc16_tk,
    decode_82a700,
    decode_82a701,
    decode_fp,
    decode_82a702,
    decode_82a703,
    decode_82a706,
    parse_frame,
)

UNIT_MODE = {
    0: "Refrigerado",
    1: "Congelado",
    2: "Planta parada",
    3: "Deshielo, inicio",
    4: "Deshielo",
    5: "Deshielo terminado",
    6: "Prueba de función, inicio",
    7: "Prueba de función",
    8: "PTI breve, inicio",
    9: "PTI de refrigerado, inicio",
    10: "PTI AFAM+, inicio",
    11: "PTI de humedad, inicio",
    12: "PTI, inicio",
    13: "PTI",
    14: "Prueba de función manual, inicio",
    15: "Prueba de función manual",
    16: "Prueba de sondas en marcha",
    17: "Prueba automática de la unidad",
    18: "Autoconfiguración",
    19: "Prueba externa, inicio",
    20: "Prueba externa",
    21: "Apagado, inicio (interno)",
    22: "Apagado (interno)",
    23: "Apagado, fin (interno)",
    24: "PTI, tirando a refrigerado",
    25: "PTI, manteniendo refrigerado",
    26: "PTI, en deshielo",
    27: "PTI, tirando a congelado",
    28: "PTI terminado, no pasó",
    29: "PTI terminado, pasó",
}

CONTROLLING = {
    0: "No optimizado",
    1: "Optimizado",
    2: "Reserva",
    3: "Reserva",
    4: "Reserva",
    5: "Bulb mode, cíclico",
    6: "Bulb mode, baja",
    7: "Bulb mode, alta",
}

REFRIGERANT = {
    0: "Desconocido",
    1: "R404a",
    2: "R452a",
    3: "R134a",
    4: "R513a",
    5: "R1234yf",
}

CONTAINER_LEN = {
    0x00: "Desconocido",
    0x31: "10′ ISO",
    0x32: "20′ ISO",
    0x34: "40′ ISO",
    0x48: "43′ ISO",
    0x4C: "45′ ISO",
}

CONTAINER_H = {0: "Desconocido", 1: "Estándar 8′6″", 2: "High cube 9′6″"}

TEST_TYPE = {
    0: "PTI",
    1: "PTI breve",
    2: "Prueba de función",
    3: "PTI AFAM",
    4: "PTI de humedad",
    5: "PTI de refrigerado",
    0xFFFF: "Sin definir",
}

RMM = {0: "No disponible", 1: "Offline", 2: "Zombie", 3: "Online"}

CT_STATE = {
    0: "No definido",
    1: "No es una opción",
    2: "No permitido: hay multi-temperatura",
    10: "Sin acción",
    11: "Pendiente de arranque",
    12: "Activo",
    13: "Terminado, falta aceptar",
    14: "Terminación aceptada",
}

MTS_STATE = {
    **CT_STATE,
    2: "No permitido: hay tratamiento de frío",
    15: "Pendiente de parada",
}

SENSOR_ES = [
    ("supply1_air_temp", "Suministro 1"),
    ("supply2_air_temp", "Suministro 2"),
    ("return_air_temp", "Retorno"),
    ("evaporator1_coil_temp", "Serpentín evaporador"),
    ("condenser_coil_temp", "Serpentín condensador"),
    ("compressor_coil_temp", "Serpentín compresor"),
    ("compressor2_coil_temp", "Serpentín compresor 2"),
    ("ambient_air_temp", "Ambiente"),
    ("cargo1_temp", "Carga 1"),
    ("cargo2_temp", "Carga 2"),
    ("cargo3_temp", "Carga 3"),
    ("cargo4_temp", "Carga 4"),
    ("relative_humidity", "Humedad"),
    ("avlv", "Aire fresco medido"),
    ("suction_pressure", "Presión de succión"),
    ("discharge_pressure", "Presión de descarga"),
    ("line_voltage", "Tensión de línea"),
    ("line_frequency", "Frecuencia"),
    ("current_ph1", "Corriente fase 1"),
    ("current_ph2", "Corriente fase 2"),
    ("current_ph3", "Corriente fase 3"),
    ("co2", "CO₂"),
    ("o2", "O₂"),
    ("evaporator_fan_speed", "Ventilador evaporador"),
    ("condenser_fan_speed", "Ventilador condensador"),
    ("datalogger_battery_voltage", "Batería del logger"),
    ("power_meter_reading", "Medidor de energía"),
    ("power_meter_trip_reading", "Energía del viaje"),
    ("power_meter_trip_duration", "Duración del medidor"),
    ("suction_temp", "Temperatura de succión"),
    ("discharge_temp", "Temperatura de descarga"),
    ("supply_air_temp_showoff", "Suministro mostrado"),
    ("return_air_temp_showoff", "Retorno mostrado"),
    ("dl_battery_temp", "Temperatura batería logger"),
    ("dl_battery_charge_current", "Corriente de carga logger"),
    ("power_consumption", "Consumo"),
    ("power_consumption_avg_per_hour", "Consumo medio por hora"),
    ("suction2_pressure", "Presión succión 2"),
    ("suction2_temp", "Temperatura succión 2"),
]


def build_frame(data_hex: str) -> str:
    data = bytes.fromhex(data_hex)
    body = bytes((0x04, 0x00, 0x00)) + data
    crc = crc16_tk(body)
    raw = bytes((0x1B, 0x02)) + body + bytes(((crc >> 8) & 0xFF, crc & 0xFF, 0x1B, 0x04))
    return raw.hex().upper()


def _spec(cid: str, title: str, data_hex: str, expect: str) -> dict[str, str]:
    return {
        "id": cid,
        "title": title,
        "hex": build_frame(data_hex),
        "expect": expect,
        "data": data_hex.upper(),
    }


# Lecturas. Ninguna de estas escribe en el controlador.
CATALOG: list[dict[str, str]] = [
    _spec("sensors", "Sensores", "82A71000", "82a700"),
    _spec("control", "Control", "82A71001", "82a701"),
    _spec("io", "Entradas y salidas", "82A71002", "82a702"),
    _spec("caption", "Container ID", "82A71003", "82a703"),
    _spec("trip", "Inicio de viaje", "82A71004", "82a704"),
    _spec("config", "Configuración", "82A71005", "82a705"),
    _spec("alarms", "Alarmas", "82A71006", "82a706"),
    _spec("info_a", "Información A", "82A71007", "82a707"),
    _spec("info_b", "Información B", "82A71008", "82a708"),
    _spec("info_c", "Información C", "82A71009", "82a709"),
    _spec("ext", "Información extendida", "82A71020", "82a720"),
    _spec("product", "Identidad de placa", "0201", "0202"),
    _spec("product_name", "Nombre de producto", "0204", "0203"),
    _spec("app_info", "Versión de aplicación", "020900", "0208"),
    _spec("ct", "Tratamiento de frío", "82A78800", "82a788"),
    _spec("mts", "Multi-temperatura", "82A78900", "82a789"),
    _spec("night", "Silencio nocturno", "82A78A00", "82a78a"),
    _spec("ripener", "Madurador", "82A78C00", "82a78c"),
    _spec("log_index", "Índices del log", "821930", "821931"),
]

BY_ID = {row["id"]: row for row in CATALOG}


def catalog() -> list[dict[str, str]]:
    return [
        {"id": row["id"], "title": row["title"], "hex": row["hex"], "expect": row["expect"]}
        for row in CATALOG
    ]


def _u16(data: bytes, off: int) -> int | None:
    if off + 2 > len(data):
        return None
    return int.from_bytes(data[off : off + 2], "little")


def _byte(data: bytes, off: int) -> int | None:
    return data[off] if off < len(data) else None


def _fp_text(item: dict[str, Any] | None) -> str:
    if not item:
        return "sin dato"
    if item.get("code"):
        return str(item["code"])
    status = item.get("status")
    if status == "ok":
        unit = item.get("unit") or ""
        return f"{item.get('value')} {unit}".strip()
    labels = {
        "na": "E01",
        "missing": "sin dato",
        "error": "error de sensor",
        "initializing": "E00",
        "unused": "E98",
        "open": "sensor abierto",
        "short": "sensor en corto",
        "above": "por encima de rango",
        "below": "por debajo de rango",
        "no_comm": "sin comunicación",
        "warmup": "calentando",
        "reserved": "código reservado",
    }
    return labels.get(status, str(status or "sin dato"))


def _row(name: str, value: Any, detail: str | None = None) -> dict[str, str]:
    row = {"name": name, "value": "—" if value is None else str(value)}
    if detail:
        row["detail"] = detail
    return row


def _hx(data: bytes, off: int, n: int = 2) -> str:
    return data[off : off + n].hex().upper() if off + n <= len(data) else ""


def _detail_fp(data: bytes, off: int, exp: int, item: dict[str, Any], width: int = 2) -> str:
    if off + width > len(data):
        return "no llegaron esos bytes"
    chunk = data[off : off + width]
    shown = " ".join(f"{b:02X}" for b in chunk)
    if width == 2:
        raw = int.from_bytes(chunk, "little", signed=False)
        signed = int.from_bytes(chunk, "little", signed=True)
    else:
        raw = int.from_bytes(chunk, "little", signed=False)
        signed = raw
    if item.get("status") != "ok":
        return f"{shown} → 0x{raw:0{width*2}X} → {_fp_text(item)}"
    scale = {0: "tal cual", -1: "÷10", -2: "÷100"}.get(exp, f"×10^{exp}")
    return f"{shown} → {signed} → {scale} → {_fp_text(item)}"


def _bcd(b: int) -> int | None:
    hi, lo = (b >> 4) & 0x0F, b & 0x0F
    if hi > 9 or lo > 9:
        return None
    return hi * 10 + lo


def _clock6(data: bytes, off: int) -> str:
    if off + 6 > len(data):
        return "sin dato"
    parts = [_bcd(data[off + i]) for i in range(6)]
    if any(p is None for p in parts):
        return "sin fecha"
    yy, mm, dd, hh, mi, ss = parts
    return f"20{yy:02d}-{mm:02d}-{dd:02d} {hh:02d}:{mi:02d}:{ss:02d}"


def _cstring(data: bytes, off: int, size: int) -> str:
    chunk = data[off : off + size]
    return chunk.split(b"\x00", 1)[0].decode("ascii", errors="replace").strip()


def _fp100(data: bytes, off: int, unit: str = "°C") -> str:
    return _fp_text(decode_fp(_u16(data, off), -2, unit))


def _fp10(data: bytes, off: int, unit: str = "°C") -> str:
    return _fp_text(decode_fp(_u16(data, off), -1, unit))


def fields_sensors(data: bytes) -> list[dict[str, str]]:
    decoded = decode_82a700(data)
    layout = [
        (0, "supply1_air_temp", -1, 2),
        (2, "supply2_air_temp", -1, 2),
        (4, "return_air_temp", -1, 2),
        (6, "evaporator1_coil_temp", -1, 2),
        (8, "condenser_coil_temp", -1, 2),
        (10, "compressor_coil_temp", -1, 2),
        (12, "compressor2_coil_temp", -1, 2),
        (14, "ambient_air_temp", -1, 2),
        (16, "cargo1_temp", -1, 2),
        (18, "cargo2_temp", -1, 2),
        (20, "cargo3_temp", -1, 2),
        (22, "cargo4_temp", -1, 2),
        (24, "relative_humidity", 0, 2),
        (26, "avlv", 0, 2),
        (28, "suction_pressure", -2, 2),
        (30, "discharge_pressure", -2, 2),
        (32, "line_voltage", 0, 2),
        (34, "line_frequency", 0, 2),
        (36, "current_ph1", -1, 2),
        (38, "current_ph2", -1, 2),
        (40, "current_ph3", -1, 2),
        (42, "co2", -1, 2),
        (44, "o2", -1, 2),
        (46, "evaporator_fan_speed", 0, 2),
        (48, "condenser_fan_speed", 0, 2),
        (50, "datalogger_battery_voltage", -1, 2),
        (52, "power_meter_reading", -1, 4),
        (56, "power_meter_trip_reading", -1, 4),
        (60, "power_meter_trip_duration", 0, 4),
        (64, "suction_temp", -1, 2),
        (66, "discharge_temp", -1, 2),
        (68, "supply_air_temp_showoff", -1, 2),
        (70, "return_air_temp_showoff", -1, 2),
        (72, "dl_battery_temp", -2, 2),
        (74, "dl_battery_charge_current", -2, 2),
        (76, "power_consumption", -2, 2),
        (78, "power_consumption_avg_per_hour", -2, 2),
        (80, "suction2_pressure", -1, 2),
        (82, "suction2_temp", -1, 2),
    ]
    labels = dict(SENSOR_ES)
    rows = []
    for off, key, exp, width in layout:
        item = decoded.get(key) or {}
        rows.append(_row(labels.get(key, key), _fp_text(item), _detail_fp(data, off, exp, item, width)))
    return rows


def fields_control(data: bytes) -> list[dict[str, str]]:
    d = decode_82a701(data)
    mode_id = (d.get("unit_mode") or {}).get("id")
    power = d.get("power") or {}
    valves = d.get("valves") or []
    pwr = _byte(data, 6)
    rows = [
        _row("Alarma presente", "sí" if d.get("alarm_present") else "no", _detail_fp(data, 0, 0, {"status": "ok", "value": int(bool(d.get("alarm_present"))), "unit": ""})),
        _row("Setpoint", _fp_text(d.get("temperature_setpoint")), _detail_fp(data, 2, -2, d.get("temperature_setpoint") or {})),
        _row("Carga de capacidad", _fp_text(d.get("capacity_load")), _detail_fp(data, 4, 0, d.get("capacity_load") or {})),
        _row(
            "Estado de potencia",
            f"{pwr} · CA {'sí' if power.get('ac_connected') else 'no'} · activa {'sí' if power.get('unit_active') else 'no'}",
            f"{_hx(data, 6, 1)} → bit0 alimentación, bit1 unidad activa",
        ),
        _row("Modo de control", f"{CONTROLLING.get(mode_id, 'código')} ({mode_id})", f"{_hx(data, 7, 1)} → {mode_id}"),
        _row("Control de humedad", d.get("humidity_control"), f"{_hx(data, 8, 1)} → 0 apagado, 1 deshumidificar"),
        _row("Setpoint de humedad", _fp_text(d.get("humidity_setpoint")), _detail_fp(data, 9, 0, d.get("humidity_setpoint") or {}, 1) if (d.get("humidity_setpoint") or {}).get("status") == "ok" else f"{_hx(data, 9, 1)} → E98"),
        _row("Aire fresco", d.get("fresh_air_exchange_mode"), f"{_hx(data, 10, 1)} → 0 apagado, 1 unidades, 2 demanda"),
        _row("Caudal de aire fresco", _fp_text(d.get("fresh_air_exchange_rate")), _detail_fp(data, 11, 0, d.get("fresh_air_exchange_rate") or {})),
        _row("Retardo de aire fresco", _fp_text(d.get("fresh_air_exchange_delay")), _detail_fp(data, 13, -1, d.get("fresh_air_exchange_delay") or {})),
        _row("Setpoint O₂", _fp_text(d.get("setpoint_o2")), _detail_fp(data, 15, -1, d.get("setpoint_o2") or {})),
        _row("Setpoint CO₂", _fp_text(d.get("setpoint_co2")), _detail_fp(data, 17, -1, d.get("setpoint_co2") or {})),
        _row("Fin de deshielo", _fp_text(d.get("defrost_termination_temp")), _detail_fp(data, 19, -2, d.get("defrost_termination_temp") or {})),
        _row("Intervalo de deshielo", d.get("defrost_interval_h"), f"{_hx(data, 21, 1)} → horas"),
        _row("Condensador por agua", "sí" if d.get("water_cooled_condenser") else "no", f"{_hx(data, 22, 1)}"),
        _row("Viaje USDA", "sí" if d.get("usda_trip") else "no", f"{_hx(data, 23, 1)}"),
    ]
    valve_es = {
        "evaporator_expansion": "Válvula de expansión del evaporador",
        "suction_modulation": "Válvula de modulación de succión",
        "hot_gas": "Válvula de gas caliente",
        "economizer": "Válvula economizadora",
    }
    for index, valve in enumerate(valves):
        rows.append(_row(valve_es.get(valve.get("name"), valve.get("name")), _fp_text(valve), f"{_hx(data, 24 + index, 1)} → {_fp_text(valve)}"))
    return rows


def fields_io(data: bytes) -> list[dict[str, str]]:
    names = {
        "di_lpco": "Presostato baja",
        "di_hpco": "Presostato alta",
        "do_economizer_valve": "Válvula economizadora",
        "do_digital_valve": "Válvula digital",
        "do_heater": "Calentador",
        "do_compressor": "Compresor",
        "do_evaporator_high": "Evaporador alta",
        "do_evaporator_low": "Evaporador baja",
        "do_condenser_fan": "Condensador",
        "phase_relay_1": "Relé de fase 1",
        "phase_relay_2": "Relé de fase 2",
    }
    points = decode_82a702(data).get("points") or {}
    rows = []
    for key, label in names.items():
        item = points.get(key) or {}
        if item.get("status") == "ok":
            rows.append(_row(label, "activo" if item.get("value") else "inactivo"))
        else:
            rows.append(_row(label, "no se usa" if item.get("status") == "unused" else "sin dato"))
    return rows


def fields_caption(data: bytes) -> list[dict[str, str]]:
    text = decode_82a703(data).get("container_id") or ""
    return [_row("Container ID", text or "vacío")]


def fields_trip(data: bytes) -> list[dict[str, str]]:
    return [_row("Inicio de viaje", _clock6(data, 0))]


def _quality(b: int | None) -> str:
    if b is None:
        return "sin dato"
    if b == 0:
        return "no válida"
    bands = (
        (10, 19, "estimada"),
        (20, 29, "calculada por el RMM"),
        (30, 39, "calculada por el controlador"),
        (40, 49, "medida, interna"),
        (50, 59, "medida, equipo externo"),
    )
    for lo, hi, name in bands:
        if lo <= b <= hi:
            return f"{name} ({b})"
    return f"código {b}"


def fields_config(data: bytes) -> list[dict[str, str]]:
    ca = {0: "ninguna", 1: "AVL", 2: "AFAM+"}
    unit = {0x01: "20 pies", 0x02: "slimline"}
    fan = {0: "estándar", 1: "velocidad variable"}
    length = _byte(data, 17)
    height = _byte(data, 18)
    refr = _byte(data, 15)
    return [
        _row("Offset carga A", _fp100(data, 0)),
        _row("Offset carga B", _fp100(data, 2)),
        _row("Offset carga C", _fp100(data, 4)),
        _row("Offset carga D", _fp100(data, 6)),
        _row("Límite en rango", _fp100(data, 8)),
        _row("Opción de aire", ca.get(_byte(data, 10), _byte(data, 10))),
        _row("Tipo de unidad", unit.get(_byte(data, 11), _byte(data, 11))),
        _row("Ventilador evaporador", fan.get(_byte(data, 12), _byte(data, 12))),
        _row("Ventilador condensador", fan.get(_byte(data, 13), _byte(data, 13))),
        _row("Calidad del medidor", _quality(_byte(data, 14))),
        _row("Refrigerante", REFRIGERANT.get(refr, refr)),
        _row("Largo del contenedor", CONTAINER_LEN.get(length, length)),
        _row("Alto del contenedor", CONTAINER_H.get(height, height)),
    ]


def fields_alarms(data: bytes) -> list[dict[str, str]]:
    block = decode_82a706(data)
    rows = [_row("Hay alarma", "sí" if block.get("alarm_present") else "no")]
    alarms = block.get("alarms") or []
    if not alarms:
        rows.append(_row("Listado", "ninguna"))
        return rows
    for alarm in alarms:
        flag = "reconocida" if alarm.get("acknowledged") else "sin reconocer"
        rows.append(_row(f"Alarma {alarm.get('slot')}", f"número {alarm.get('number')}, {flag}"))
    return rows


def _mask(value: int | None, names: list[tuple[int, str]]) -> str:
    if value is None:
        return "sin dato"
    hits = [label for bit, label in names if value & bit]
    return ", ".join(hits) if hits else "ninguno"


def fields_info_a(data: bytes) -> list[dict[str, str]]:
    mode = _byte(data, 0)
    ct = _byte(data, 5)
    mts = _byte(data, 6)
    rmm = _byte(data, 8)
    ct_name = {0x01: "activo", 0x02: "aprobado"}.get(ct, ct)
    mts_name = {0x01: "activo", 0x02: "acercándose", 0x04: "manteniendo", 0x80: "último paso"}.get(mts, mts)
    return [
        _row("Modo de la unidad", UNIT_MODE.get(mode, f"código {mode}")),
        _row("Minutos de apagado por operador", _byte(data, 1)),
        _row("En rango", "sí" if _byte(data, 2) == 1 else "no"),
        _row("Enfriamiento por agua", "sí" if _byte(data, 3) == 1 else "no"),
        _row(
            "Frío limitado",
            _mask(
                _byte(data, 4),
                [(0x01, "limitado"), (0x02, "condensador"), (0x04, "agua"), (0x08, "corriente"), (0x10, "potencia")],
            ),
        ),
        _row("Tratamiento de frío", ct_name),
        _row("Multi-temperatura", mts_name),
        _row("Paso multi-temperatura", _byte(data, 7)),
        _row("Módem", RMM.get(rmm, rmm)),
    ]


def fields_info_b(data: bytes) -> list[dict[str, str]]:
    def version_bcd(off: int) -> str:
        if off + 4 > len(data):
            return "sin dato"
        parts = [_bcd(data[off + i]) for i in range(4)]
        if any(p is None for p in parts):
            return data[off : off + 4].hex()
        return ".".join(f"{p:02d}" for p in parts)

    firmware = data[4:8].hex() if len(data) >= 8 else "sin dato"
    if len(firmware) == 8:
        firmware = ".".join(firmware[i : i + 2] for i in range(0, 8, 2))
    dates = [
        (52, "Encendido"),
        (58, "Último apagado"),
        (64, "Último deshielo"),
        (70, "Inicio tratamiento de frío"),
        (76, "Fin previsto tratamiento de frío"),
        (118, "Último inicio de viaje"),
        (124, "Hora del data logger"),
    ]
    pti = _u16(data, 134)
    pti_name = {0: "vacío", 1: "aprobado", 2: "fallido", 3: "aprobado, no guardado"}.get(pti, pti)
    rows = [
        _row("Versión de aplicación", version_bcd(0)),
        _row("Firmware", firmware),
        _row("Equipment ID", data[8:12].hex() if len(data) >= 12 else "sin dato"),
        _row("Serie de la unidad", _cstring(data, 12, 20)),
        _row("ID de unidad", _cstring(data, 32, 20)),
        _row("Serie reefer", _cstring(data, 148, 20)),
        _row("PTI smart en uso", "sí" if _byte(data, 132) not in (None, 0) else "no"),
        _row("Validez PTI smart", None if _byte(data, 133) is None else f"{_byte(data, 133)} días"),
        _row("Estado PTI smart", pti_name),
    ]
    rows.extend(_row(label, _clock6(data, off)) for off, label in dates)
    return rows


def fields_info_c(data: bytes) -> list[dict[str, str]]:
    kind = _u16(data, 6)
    result = _u16(data, 8)
    if result == 0xFFFF:
        outcome = "no se conoce"
    elif result == 0xFFFE:
        outcome = "en curso"
    elif result == 0xFFFD:
        outcome = "aprobado"
    elif result is None:
        outcome = "sin dato"
    else:
        outcome = f"no pasó, alarma {result}"
    return [
        _row("Inicio del ensayo", _clock6(data, 0)),
        _row("Tipo", TEST_TYPE.get(kind, kind)),
        _row("Resultado", outcome),
        _row("Fin del ensayo", _clock6(data, 10)),
    ]


def fields_ext(data: bytes) -> list[dict[str, str]]:
    year = _byte(data, 31)
    month = _byte(data, 32)
    day = _byte(data, 33)
    clock = "sin dato"
    if None not in (year, month, day) and _byte(data, 34) is not None:
        clock = (
            f"{2000 + year:04d}-{month:02d}-{day:02d} "
            f"{_byte(data, 34):02d}:{(_byte(data, 35) or 0):02d}:{(_byte(data, 36) or 0):02d}"
        )
    return [
        _row("Container ID", _cstring(data, 0, 11)),
        _row("Serie del controlador", _cstring(data, 11, 20)),
        _row("Reloj del controlador", clock),
        _row("Setpoint", _fp10(data, 37)),
        _row("Retorno", _fp10(data, 39)),
        _row("Suministro", _fp10(data, 41)),
    ]


def fields_product(data: bytes) -> list[dict[str, str]]:
    """DATA completo: formato 02, reply 02, luego la ficha."""
    run = {0: "bootloader", 1: "aplicación"}.get(_byte(data, 23), _byte(data, 23))
    return [
        _row("Revisión de hardware", _byte(data, 3)),
        _row("Tipo de hardware", _byte(data, 4)),
        _row("Serie de hardware", data[10:14].hex() if len(data) >= 14 else "sin dato"),
        _row("Modo de marcha", run),
    ]


def fields_name(data: bytes) -> list[dict[str, str]]:
    return [_row("Nombre", _cstring(data, 2, max(1, len(data) - 2)))]


def fields_app(data: bytes) -> list[dict[str, str]]:
    def word(off: int) -> str:
        raw = _u16(data, off)
        if raw is None or raw == 0xFFFF:
            return "sin dato"
        return str(raw)

    return [
        _row("Tipo de versión", _byte(data, 2)),
        _row("Major", word(3)),
        _row("Minor", word(5)),
        _row("Revisión", word(7)),
        _row("Build", word(9)),
    ]


def _batch_state(table: dict[int, str], data: bytes) -> list[dict[str, str]]:
    action = _byte(data, 0)
    state = _byte(data, 1)
    reply = bool(action is not None and action & 0x80)
    code = (action or 0) & 0x7F
    actions = {
        0: "devolver estado",
        1: "cargar sin arrancar",
        2: "arrancar",
        3: "arrancar con lo ya cargado",
        4: "parar",
        5: "aceptar",
        6: "cargar cierre",
    }
    return [
        _row("Es respuesta", "sí" if reply else "no"),
        _row("Acción", actions.get(code, code)),
        _row("Estado", table.get(state, state)),
    ]


def fields_ct(data: bytes) -> list[dict[str, str]]:
    rows = _batch_state(CT_STATE, data)
    rows.extend(
        [
            _row("Temperatura", _fp10(data, 3)),
            _row("Periodo", None if _u16(data, 5) is None else f"{_u16(data, 5)} h"),
            _row("Máximo USDA", _fp10(data, 7)),
            _row("Temperatura final", _fp10(data, 9)),
        ]
    )
    return rows


def fields_mts(data: bytes) -> list[dict[str, str]]:
    rows = _batch_state(MTS_STATE, data)
    for step in range(10):
        off = 3 + step * 4
        rows.append(_row(f"Paso {step + 1}", f"{_fp10(data, off)} / {_u16(data, off + 2)} h"))
    rows.append(_row("Paso activo", _byte(data, 43)))
    return rows


def fields_night(data: bytes) -> list[dict[str, str]]:
    start = _u16(data, 4)
    stop = _u16(data, 6)

    def slot(value: int | None) -> str:
        if value is None:
            return "sin dato"
        minutes = value * 5
        return f"{minutes // 60:02d}:{minutes % 60:02d}"

    return [
        _row("Pausa de maquinaria", None if _u16(data, 1) is None else f"{_u16(data, 1)} min"),
        _row("Operación silenciosa", "encendida" if _byte(data, 3) == 1 else "apagada"),
        _row("Inicio del silencio", slot(start)),
        _row("Fin del silencio", slot(stop)),
        _row("Máquina detenida", "sí" if _byte(data, 9) == 1 else "no"),
    ]


def fields_ripener(data: bytes) -> list[dict[str, str]]:
    state = {
        0: "no definido",
        1: "no es una opción",
        2: "no permitido",
        3: "no activo",
        4: "esperando el retardo",
        5: "inyectando",
        6: "inyectando, frío parado",
    }.get(_byte(data, 1), _byte(data, 1))
    ppm = _u16(data, 13)
    return [
        _row("Estado", state),
        _row("Opción", "habilitada" if _u16(data, 3) == 1 else "no habilitada"),
        _row("Inyección", "encendida" if _u16(data, 5) == 1 else "apagada"),
        _row("Consigna", None if _u16(data, 7) in (None, 0xFFFF) else f"{_u16(data, 7)} ppm"),
        _row("Lectura de etileno", "fuera de rango" if ppm is not None and ppm > 1000 else (None if ppm is None else f"{ppm} ppm")),
    ]


def fields_log_index(data: bytes) -> list[dict[str, str]]:
    oldest = int.from_bytes(data[0:4], "little") if len(data) >= 4 else None
    newest = int.from_bytes(data[4:8], "little") if len(data) >= 8 else None
    return [_row("Índice más antiguo", oldest), _row("Índice más nuevo", newest)]


ANALYZERS = {
    "sensors": ("Sensores", "82A700", fields_sensors),
    "control": ("Control", "82A701", fields_control),
    "io": ("Entradas y salidas", "82A702", fields_io),
    "caption": ("Container ID", "82A703", fields_caption),
    "trip": ("Inicio de viaje", "82A704", fields_trip),
    "config": ("Configuración", "82A705", fields_config),
    "alarms": ("Alarmas", "82A706", fields_alarms),
    "info_a": ("Información A", "82A707", fields_info_a),
    "info_b": ("Información B", "82A708", fields_info_b),
    "info_c": ("Información C", "82A709", fields_info_c),
    "ext": ("Información extendida", "82A720", fields_ext),
    "product": ("Identidad de placa", "0202", fields_product),
    "product_name": ("Nombre de producto", "0203", fields_name),
    "app_info": ("Versión de aplicación", "0208", fields_app),
    "ct": ("Tratamiento de frío", "82A788", fields_ct),
    "mts": ("Multi-temperatura", "82A789", fields_mts),
    "night": ("Silencio nocturno", "82A78A", fields_night),
    "ripener": ("Madurador", "82A78C", fields_ripener),
    "log_index": ("Índices del log", "821931", fields_log_index),
}

_BY_OPCODE = {op: cid for cid, (_title, op, _fn) in ANALYZERS.items()}


def frames_in(text: str) -> list[dict[str, str | None]]:
    """Todas las tramas 1B02…1B04 que haya en el texto, aunque venga un JSON con d02 y d03."""
    blob = "".join(ch for ch in str(text or "") if ch in "0123456789abcdefABCDEF")
    low = blob.lower()
    imei = None
    head = low.split("1b02", 1)[0]
    cut = head.rfind("ffffffff")
    sample = head[:cut] if cut >= 0 else head
    try:
        raw_head = bytes.fromhex(sample)
        text_imei = raw_head.decode("ascii")
        if text_imei.isdigit() and 14 <= len(text_imei) <= 17:
            imei = text_imei
    except ValueError:
        imei = None
    found: list[dict[str, str | None]] = []
    start = 0
    while True:
        at = low.find("1b02", start)
        if at < 0:
            break
        end = low.find("1b04", at + 4)
        if end < 0:
            break
        found.append({"imei": imei, "frame": low[at : end + 4]})
        start = end + 4
    return found


def isolate_frame(text: str) -> dict[str, str | None]:
    """Quita el IMEI y el ffffffff. Devuelve la trama 1B02…1B04."""
    blob = "".join(str(text or "").split())
    hx = "".join(ch for ch in blob if ch in "0123456789abcdefABCDEF")
    low = hx.lower()
    start = low.find("1b02")
    imei = None
    if start > 0:
        head = low[:start]
        cut = head.rfind("ffffffff")
        sample = head[:cut] if cut >= 0 else head
        try:
            raw = bytes.fromhex(sample)
            text_imei = raw.decode("ascii")
            if text_imei.isdigit() and 14 <= len(text_imei) <= 17:
                imei = text_imei
        except ValueError:
            imei = None
    if start < 0:
        return {"imei": imei, "frame": low}
    end = low.find("1b04", start + 4)
    frame = low[start:] if end < 0 else low[start : end + 4]
    return {"imei": imei, "frame": frame}


_SYSTEM = {"product", "product_name", "app_info"}


def decode_pasted(text: str, query: str | None = None) -> dict[str, Any]:
    found = isolate_frame(text)
    frame = parse_frame(found["frame"] or "")
    if not frame:
        return {
            "ok": False,
            "error": "no hay una trama 1B02…1B04",
            "imei": found["imei"],
            "fields": [],
        }
    opcode = frame["opcode"]
    chosen = query if query in ANALYZERS else None
    if chosen is None:
        chosen = _BY_OPCODE.get(opcode)
    title = "Trama"
    fields: list[dict[str, str]] = []
    if chosen:
        title, _op, fn = ANALYZERS[chosen]
        if chosen in _SYSTEM:
            data = bytes.fromhex(opcode) + frame["data"]
        else:
            data = frame["data"]
        fields = fn(data)
    else:
        title = f"Sin mapa para {opcode}"
    return {
        "ok": True,
        "query": chosen,
        "title": title,
        "opcode": opcode,
        "crc_ok": frame["crc_ok"],
        "imei": found["imei"],
        "frame": (found["frame"] or "").upper(),
        "fields": fields,
        "warning": None if frame["crc_ok"] else "el CRC no cierra",
    }


def decode_document(text: str, query: str | None = None) -> dict[str, Any]:
    pieces = frames_in(text)
    if not pieces:
        one = decode_pasted(text, query)
        one["items"] = [one] if one.get("fields") else []
        return one
    items = []
    for piece in pieces:
        # Cada trama se clasifica por su propio opcode, salvo que pidan un tipo fijo.
        item = decode_pasted(piece["frame"] or "", query)
        if piece.get("imei") and not item.get("imei"):
            item["imei"] = piece["imei"]
        items.append(item)
    first = items[0]
    return {**first, "items": items, "ok": any(item.get("ok") for item in items)}
