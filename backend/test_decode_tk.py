from decode_tk import decode_hex_block, decode_unit_status

SAMPLE = (
    '{"i":"POLLO_BEBE",'
    '"d01":"1B0204000082A700F600FE7FEB00FB00F200EA00FF7FEF00EF00F000F000F0004300'
    "FE7FFE7FFE7FC8013C00560055005600FE7FFE7F000064002003760F0000E2020000DEAF0C00"
    "FE7FFE7FF600EB00FE7F000034022000FE7FFF7FFE7FFE7FA9D51B04\","
    '"d02":"1B0204000082A701010098082D000304016302FE7FFE7FFE7F7D000807030000FFFFFFFFA07F1B04",'
    '"d03":"1B0204000082A702000000000000000001010000000000000000000000000001010093CE1B04",'
    '"d04":"1B0204000082A7034C4F535531393638313030ABF51B04",'
    '"d05":"1B0204000082A70601003900FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFB3BB1B04"}'
    '{"i":"POLLO_BEBE","rs":"MP5000_GET_INFO"}'
)


def test_blocks_and_snapshot():
    st = decode_unit_status(SAMPLE)
    assert st is not None
    assert st["i"] == "POLLO_BEBE"
    assert st["crc_all_ok"] is True
    assert st["snapshot"]["container_id"] == "LOSU1968100"
    assert st["snapshot"]["unit_mode"] == "defrost_ended"
    assert st["snapshot"]["setpoint_c"] == 22.0
    assert st["snapshot"]["capacity_load_pct"] == 45
    assert st["snapshot"]["ac_connected"] is True
    assert st["snapshot"]["unit_active"] is True
    assert st["snapshot"]["alarm_present"] is True
    assert st["snapshot"]["alarms"][0]["number"] == 57
    assert st["snapshot"]["alarms"][0]["acknowledged"] is False
    assert st["io"]["points"]["do_condenser_fan"]["value"] is True
    assert st["io"]["points"]["do_compressor"]["value"] is False
    assert abs(st["sensors"]["supply1_air_temp"]["value"] - 24.6) < 0.05


def test_alarm_ack():
    block = decode_hex_block(
        "1B0204000082A70601003980FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF21721B04"
    )
    assert block["crc_ok"]
    a = block["alarms"]["alarms"][0]
    assert a["number"] == 57
    assert a["acknowledged"] is True


if __name__ == "__main__":
    test_blocks_and_snapshot()
    test_alarm_ack()
    print("ok")
