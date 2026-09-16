"""Criterios de caso_starcool.md (trama serial real, sin Mongo / HTTP)."""

from starcool import MARKER, build_payload, parse_frame, parse_rx_hex

# RX del serial (HDR 16:55:37) — incluye el 38 inicial del IMEI.
SERIAL_RX = (
    "383639333837303635333334313838161693c003c003c003c013c60bc007c007c007c00be0030000"
    "db0d8c0eff1a091010370cfe00ff00ff00ffffffffffffffffffffffff00000000000000000000"
    "000000000000000000000000000000000000000000000000000000000000000400000000000883"
)

TX_HEX = "161613ffffffff8457"


def test_split_imei_and_d02_from_serial():
    parsed = parse_rx_hex(SERIAL_RX)
    assert parsed is not None
    assert parsed["i"] == "869387065334188"
    assert parsed["d01"] == "METRO"
    assert parsed["d02"].startswith(MARKER)
    assert parsed["d02"].endswith("0883")
    assert SERIAL_RX.lower().startswith("38363933")


def test_payload_matches_caso():
    parsed = parse_rx_hex(SERIAL_RX)
    payload = build_payload(parsed["i"], parsed["d02"])
    assert payload == {
        "i": "869387065334188",
        "d01": "METRO",
        "d02": parsed["d02"],
    }


def test_ignores_tx_and_headers():
    assert parse_rx_hex(TX_HEX) is None
    assert parse_frame({"direction": "tx", "hex": SERIAL_RX}) is None
    assert parse_frame({"direction": "rx", "value_type": "tcp_header", "hex": SERIAL_RX}) is None


def test_parse_frame_uses_hex_field():
    parsed = parse_frame({"direction": "rx", "value_type": "hex", "hex": SERIAL_RX, "text": "869387065334188"})
    assert parsed is not None
    assert parsed["i"] == "869387065334188"


def test_incomplete_without_marker():
    assert parse_rx_hex("383639333837303635333334313838") is None
