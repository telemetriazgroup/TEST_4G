"""Criterios de aceptación de datos_homologar.md (sin Mongo / HTTP)."""

from homologate import build_standard, classify_frame, date_key, hour_key, split_json_objects

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


def test_forma_a_standard_payload():
    classified = classify_frame(
        {"direction": "rx", "value_type": "hex", "text": SAMPLE_CONCAT}
    )
    assert classified["status"] == "ready"
    p = classified["payload"]
    assert p["i"] == "POLLO_BEBE"
    assert p["d01"] == "UNIT111"
    assert "82A700" in p["d02"]
    assert "82A701" in p["d03"]
    assert "82A706" in p["d08"]
    assert "82A702" not in p.get("d02", "")
    assert list(p.keys()) == ["i", "d01", "d02", "d03", "d08"]


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
            "text": "CONNECT 1.2.3.4:1 → 9910",
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


def test_hour_key_lima():
    assert hour_key("2026-09-09T15:26:41.752381Z") == "2026-09-09 10:00"
    assert date_key("2026-09-09T15:26:41.752381Z") == "2026-09-09"


if __name__ == "__main__":
    test_split_concat_does_not_post_rs()
    test_forma_a_standard_payload()
    test_rs_and_header_skipped()
    test_forma_b_does_not_map_alarm_to_d02()
    test_hour_key_lima()
    print("ok")
