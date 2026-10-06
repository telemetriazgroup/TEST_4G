"""Equivalencia madurador fase actual (logica_madurador_carne.md), sin Mongo / HTTP."""

from homologate import (
    D3_STATIC,
    D4_STATIC,
    build_standard,
    classify_frame,
    date_key,
    fecha_utc_ms,
    hour_key,
    local_stamp,
    mongo_load_doc,
    split_json_objects,
)

MAD_D01 = (
    "1B0204000082A7009600FE7FA20088008F018C02FF7FFF009E00A1009C009D005000FE7FFE7FFE7F"
    "B3013C0052004F005600FE7FFE7F1E0033002D03E33200004432000026180D00FE7FFE7F9600A200"
    "FE7F0000F6011C02FE7FFF7FFE7FFE7FD9411B04"
)
MAD_D02 = "1B0204000082A7010100DC052B000300014E00FE7FFE7FFE7FFE7F0807060000FFFFFFFFB0E61B04"
MAD_FRAME = (
    '{"i":"MAD_CARNE","rs":"MP5000_GET_DATA"}'
    '{"i":"MAD_CARNE","d01":"' + MAD_D01 + '","d02":"' + MAD_D02 + '",'
    '"d03":"1B0204000082A702000000010101000100010000000000000000000000000001010170E41B04",'
    '"d04":"1B0204000082A7034C4F535531393935323730374D1B04",'
    '"d05":"1B0204000082A70601003900FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFB3BB1B04"}'
    '{"i":"MAD_CARNE","rs":"RELE001_DATA:0 0 0 0 0 0 0 1,0,0.0"}'
)

SAMPLE_CONCAT = (
    '{"i":"POLLO_BEBE","d01":"1B0204000082A700F600FE7FEB00FB00F200EA00FF7FEF00EF00F000F000F0004300'
    "FE7FFE7FFE7FC8013C00560055005600FE7FFE7F000064002003760F0000E2020000DEAF0C00FE7FFE7FF600EB00"
    "FE7F000034022000FE7FFF7FFE7FFE7FA9D51B04\",\"d02\":\"1B0204000082A701010098082D000304016302"
    "FE7FFE7FFE7F7D000807030000FFFFFFFFA07F1B04\",\"d03\":\"1B0204000082A70200000000000000000101"
    "0000000000000000000000000001010093CE1B04\",\"d04\":\"1B0204000082A7034C4F535531393638313030"
    'ABF51B04","d05":"1B0204000082A70601003900FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFB3BB1B04"}'
    '{"i":"POLLO_BEBE","rs":"MP5000_GET_INFO"}'
)

FORMA_B = (
    '{"i":"POLLO_BEBE","d01":"1B0204000082A7060000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF1D241B04'
    "FE7FFE7FFE7FC6013C00010000000100FE7FFE7F0000000030033B0D0000A7000000781C0600FE7FFE7FDA00DB00"
    "FE7F000005000F00FE7FFF7FFE7FFE7FB5AB1B04\",\"d02\":\"1B0204000082A701000092099CFF030400FE00"
    "FE7FFE7FFE7FFE7F0807030000FFFFFFFF47FF1B04\",\"d03\":\"1B0204000082A70200000000000000000000"
    '01000000000000000000000000000000DF381B04","d04":"1B0204000082A7034C4F535531393638313030ABF51B04"}'
)


def test_split_concat_does_not_post_rs():
    objs = split_json_objects(SAMPLE_CONCAT)
    assert len(objs) == 2
    assert "d01" in objs[0]
    assert objs[1].get("rs") == "MP5000_GET_INFO"


def test_madurador_maps_d1_d2_and_static():
    classified = classify_frame(
        {"direction": "rx", "value_type": "hex", "text": MAD_FRAME}
    )
    assert classified["status"] == "ready"
    p = classified["payload"]
    assert p == {
        "i": "MAD_CARNE",
        "d1": MAD_D01,
        "d2": MAD_D02,
        "d3": D3_STATIC,
        "d4": D4_STATIC,
    }
    assert "82A702" not in p["d1"]
    assert "82A706" not in "".join(p.values())
    assert list(p.keys()) == ["i", "d1", "d2", "d3", "d4"]


def test_opcode_in_other_field_does_not_fill_d1():
    """82A700 en d02 no cuenta como d1: el nombre del campo manda."""
    swapped = (
        '{"i":"MAD_CARNE","d01":"' + MAD_D02 + '","d02":"' + MAD_D01 + '"}'
    )
    assert build_standard(split_json_objects(swapped)[0]) is None
    classified = classify_frame({"direction": "rx", "value_type": "hex", "text": swapped})
    assert classified["status"] == "incomplete"


def test_rs_and_header_skipped():
    rs = classify_frame(
        {
            "direction": "rx",
            "value_type": "hex",
            "text": '{"i":"POLLO_BEBE","rs":"MP5000_GET_DATA"}',
        }
    )
    assert rs["status"] == "skip"
    assert rs["reason"] == "status_rs"

    hdr = classify_frame(
        {
            "direction": "rx",
            "value_type": "tcp_header",
            "text": "CONNECT 1.2.3.4:1 → 9912",
        }
    )
    assert hdr["status"] == "skip"
    assert hdr["reason"] == "tcp_header"


def test_forma_b_does_not_map_alarm_to_d02():
    objs = split_json_objects(FORMA_B)
    payload = build_standard(objs[0])
    assert payload is None  # falta 82A700
    classified = classify_frame({"direction": "rx", "value_type": "hex", "text": FORMA_B})
    assert classified["status"] == "incomplete"
    assert "82A706" in classified["opcodes"]
    assert "82A700" not in classified["opcodes"]


def test_mongo_load_keeps_utc():
    classified = classify_frame({"direction": "rx", "value_type": "hex", "text": MAD_FRAME})
    doc = mongo_load_doc(classified["payload"], "2026-10-06T18:12:22.970555Z")
    assert doc["estado"] == 1
    assert doc["fecha"] == {"$date": "2026-10-06T18:12:22.970Z"}
    assert doc["d3"] == D3_STATIC
    assert doc["d4"] == D4_STATIC
    assert fecha_utc_ms("2026-10-06T18:12:22.970555Z") == "2026-10-06T18:12:22.970Z"
    assert local_stamp("2026-10-06T18:12:22.970555Z") == "2026-10-06 13:12:22"


def test_hour_key_lima():
    assert hour_key("2026-09-09T15:26:41.752381Z") == "2026-09-09 10:00"
    assert date_key("2026-09-09T15:26:41.752381Z") == "2026-09-09"


if __name__ == "__main__":
    test_split_concat_does_not_post_rs()
    test_madurador_maps_d1_d2_and_static()
    test_opcode_in_other_field_does_not_fill_d1()
    test_rs_and_header_skipped()
    test_forma_b_does_not_map_alarm_to_d02()
    test_mongo_load_keeps_utc()
    test_hour_key_lima()
    print("ok")
