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


def _i16(data: bytes, off: int) -> int | None:
    if off + 2 > len(data):
        return None
    return int.from_bytes(data[off : off + 2], "little", signed=True)


def _byte(data: bytes, off: int) -> int | None:
    return data[off] if off < len(data) else None


def _fp_text(item: dict[str, Any] | None) -> str:
    if not item:
        return "sin dato"
    status = item.get("status")
    if status == "ok":
        unit = item.get("unit") or ""
        return f"{item.get('value')} {unit}".strip()
    labels = {
        "na": "no aplica",
        "missing": "sin dato",
        "error": "error de sensor",
        "initializing": "inicializando",
        "unused": "no se usa",
        "open": "abierto",
        "short": "corto",
        "above": "por encima",
        "below": "por debajo",
        "no_comm": "sin comunicación",
        "warmup": "calentando",
    }
    return labels.get(status, str(status or "sin dato"))


def _row(name: str, value: Any) -> dict[str, str]:
    return {"name": name, "value": "—" if value is None else str(value)}


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
    raw = _i16(data, off)
    if raw is None:
        return "sin dato"
    u = raw & 0xFFFF
    if u >= 0x7FF0:
        return "no aplica"
    return f"{raw / 100:.2f} {unit}"


def _fp10(data: bytes, off: int, unit: str = "°C") -> str:
    raw = _i16(data, off)
    if raw is None:
        return "sin dato"
    if (raw & 0xFFFF) >= 0x7FF0:
        return "no aplica"
    return f"{raw / 10:.1f} {unit}"


def fields_sensors(data: bytes) -> list[dict[str, str]]:
    decoded = decode_82a700(data)
    return [_row(label, _fp_text(decoded.get(key))) for key, label in SENSOR_ES]


def fields_control(data: bytes) -> list[dict[str, str]]:
    d = decode_82a701(data)
    mode_id = (d.get("unit_mode") or {}).get("id")
    power = d.get("power") or {}
    valves = d.get("valves") or []
    rows = [
        _row("Alarma presente", "sí" if d.get("alarm_present") else "no"),
        _row("Setpoint", _fp_text(d.get("temperature_setpoint"))),
        _row("Carga de capacidad", _fp_text(d.get("capacity_load"))),
        _row("Alimentación CA", "sí" if power.get("ac_connected") else "no"),
        _row("Unidad activa", "sí" if power.get("unit_active") else "no"),
        _row("Modo de control", CONTROLLING.get(mode_id, f"código {mode_id}")),
        _row("Control de humedad", d.get("humidity_control")),
        _row("Setpoint de humedad", _fp_text(d.get("humidity_setpoint")) if isinstance(d.get("humidity_setpoint"), dict) else d.get("humidity_setpoint")),
        _row("Aire fresco", d.get("fresh_air_exchange_mode")),
        _row("Caudal de aire fresco", _fp_text(d.get("fresh_air_exchange_rate"))),
        _row("Retardo de aire fresco", _fp_text(d.get("fresh_air_exchange_delay"))),
        _row("Setpoint O₂", _fp_text(d.get("setpoint_o2"))),
        _row("Setpoint CO₂", _fp_text(d.get("setpoint_co2"))),
        _row("Fin de deshielo", _fp_text(d.get("defrost_termination_temp"))),
        _row("Intervalo de deshielo", d.get("defrost_interval_h")),
        _row("Condensador por agua", "sí" if d.get("water_cooled_condenser") else "no"),
        _row("Viaje USDA", "sí" if d.get("usda_trip") else "no"),
    ]
    for valve in valves:
        rows.append(_row(f"Válvula {valve.get('name')}", _fp_text(valve)))
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
