"""Criterios de caso_saasa.md y logica_comunicacion.json (sin Mongo / HTTP)."""

from saasa import (
    D01_STATIC,
    build_payload,
    command_for,
    parse_rx,
    payload_hash,
    unit_from_command,
)

UNIT888_RX = (
    '{"i":"SAASA","rs":"161693C043C023C097C07BC6BBC023E003E003E003E0030000'
    "D60F8C0EBE1A090E14160CFE00FF00FF00FFFFFFFFFFFFFFFFFFFFFFFFD286000000"
    "00000000000000000000000000000000000000000000000000000000000000000000"
    '000000040000000000C5D0"}'
)

UNIT111_RX = (
    '{"i":"SAASA","rs":"161693C0C3C0BBC137C137C813C0BFE003E003E003E0030000'
    "C7108B0EFF1A090E14140CFE00FF00FF00FFFFFFFFFFFFFFFFFFFFFFFF0000000000"
    "00000000000000000000000000000000000000000000000000000000000000000000"
    '000000000400000000008307"}'
)


def test_command_and_unit():
    assert command_for("saasa_unit888") == "SAASA_UNIT888_GET_DATA"
    assert unit_from_command("SAASA_UNIT111_GET_DATA") == "SAASA_UNIT111"
    assert unit_from_command("AT") is None


def test_parse_rx_unit888_from_trace():
    parsed = parse_rx(UNIT888_RX)
    assert parsed is not None
    assert parsed["i"] == "SAASA"
    assert parsed["rs"].startswith("161693C043C023C097")
    assert parsed["rs"].endswith("C5D0")


def test_build_payload_maps_unit_not_envelope_i():
    parsed = parse_rx(UNIT888_RX)
    payload = build_payload("SAASA_UNIT888", parsed["rs"])
    assert payload == {
        "i": "SAASA_UNIT888",
        "d01": D01_STATIC,
        "d02": parsed["rs"],
    }
    assert payload["i"] != parsed["i"]


def test_ignores_get_data_imei_and_pollo():
    assert parse_rx("SAASA_UNIT111_GET_DATA") is None
    assert parse_rx("869387065334238") is None
    assert parse_rx('{"i":"POLLO_BEBE","rs":"MP5000_GET_DATA"}') is None
    assert parse_rx('{"i":"SAASA","rs":"SAASA_UNIT111_GET_DATA"}') is None


def test_payload_hash_stable():
    a = build_payload("SAASA_UNIT111", parse_rx(UNIT111_RX)["rs"])
    b = build_payload("SAASA_UNIT111", parse_rx(UNIT111_RX)["rs"])
    assert payload_hash(a) == payload_hash(b)
