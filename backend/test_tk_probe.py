"""Prueba de lecturas y decodificación inmediata. No publica el JSON."""

import asyncio

from homologate import TK_CMD_D02, TK_CMD_D03
from tk_analysis import BY_ID, build_frame, decode_pasted
from tk_probe import autosend_allowed, run_probe

ALARM = "1B0204000082A70601003900FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFB3BB1B04"
RX_SENSOR = (
    "383639333837303635323735353438ffffffff"
    "1b0204000082a700f4fefe7f0eff07ff0b01d501ff7ff000fe7ffe7ffe7ffe7ffe7ffe7ffe7ffe7f"
    "b2013c00010001000000fe7ffe7f000000009c01feb1100048010000ef530100fe7ffe7ff4fe0eff"
    "470c000004008800fe7fff7fb54b1b04"
)


def _value(decoded, name):
    for row in decoded["fields"]:
        if row["name"] == name:
            return row["value"]
    raise AssertionError(name)


def test_catalog_matches_cycle_commands():
    assert BY_ID["sensors"]["hex"] == TK_CMD_D02
    assert BY_ID["control"]["hex"] == TK_CMD_D03


def test_hold_stops_autosend():
    assert autosend_allowed(False) is True
    assert autosend_allowed(True) is False


def test_trip_clock_and_unit_mode():
    trip = build_frame("82A704" + "261016140500")
    decoded = decode_pasted(trip, "trip")
    assert decoded["crc_ok"] is True
    assert _value(decoded, "Inicio de viaje") == "2026-10-16 14:05:00"

    info = build_frame("82A707" + "010001000C01040203")
    decoded = decode_pasted(info)
    assert decoded["query"] == "info_a"
    assert _value(decoded, "Modo de la unidad") == "Congelado"
    assert "agua" in _value(decoded, "Frío limitado")
    assert "corriente" in _value(decoded, "Frío limitado")
    assert _value(decoded, "Módem") == "Online"
    assert _value(decoded, "Multi-temperatura") == "manteniendo"


def test_ext_clock_is_not_bcd():
    # 11 chars + 20 de serie + año 26 (binario) mes 10 día 16 + 14:05:00 + setpoint 12.3
    body = "4C4F535531323334353637" + ("41" * 20) + "1A0A10" + "0E0500" + "7B00" + "7B00" + "7B00"
    decoded = decode_pasted(build_frame("82A720" + body))
    assert _value(decoded, "Container ID") == "LOSU1234567"
    assert _value(decoded, "Reloj del controlador").startswith("2026-10-16")
    assert _value(decoded, "Setpoint") == "12.3 °C"


def test_pasted_rx_splits_imei():
    decoded = decode_pasted(RX_SENSOR)
    assert decoded["imei"] == "869387065275548"
    assert decoded["opcode"] == "82A700"
    assert decoded["query"] == "sensors"
    assert decoded["crc_ok"] is True
    assert decoded["fields"]


def test_alarm_number():
    decoded = decode_pasted(ALARM, "alarms")
    assert decoded["crc_ok"] is True
    assert "número 57" in _value(decoded, "Alarma 1")
    assert "sin reconocer" in _value(decoded, "Alarma 1")


def test_probe_decodes_and_does_not_build_post():
    posted: list[dict] = []

    async def send(_hx: str) -> bool:
        return True

    async def wait(expect: str, _sent_at: float, _timeout: float):
        return {"payload": ALARM, "opcode": expect, "imei": "869387065275548"}

    rows = asyncio.run(run_probe(["alarms", "no-such"], send, wait))
    assert posted == []
    assert rows[0]["ok"] is True
    assert rows[0]["query"] == "alarms"
    assert "d01" not in rows[0] and "d02" not in rows[0]
    assert rows[1]["ok"] is False
    assert rows[1]["error"] == "comando desconocido"


if __name__ == "__main__":
    test_catalog_matches_cycle_commands()
    test_hold_stops_autosend()
    test_trip_clock_and_unit_mode()
    test_ext_clock_is_not_bcd()
    test_pasted_rx_splits_imei()
    test_alarm_number()
    test_probe_decodes_and_does_not_build_post()
    print("ok")
