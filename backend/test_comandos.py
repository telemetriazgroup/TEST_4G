from comandos import (
    build_mp5000,
    build_pot,
    build_relay,
    classify_window,
    encode_line,
)


def test_window_v1_and_close():
    assert classify_window('{"i":"POLLO_BEBE","rs":"RELAY001_DATA:1 0 1"}') == "V1"
    assert classify_window('{"i":"X","rs":"INFO:24.1,23.3,22.0"}') == "V2"
    assert classify_window('{"i":"X","rs":"MP5000_GET_DATA"}') == "close"
    assert classify_window('{"i":"X","rs":"RELAY001_GET_DATA"}') == "close"
    concat = '{"rs":"RELAY001_GET_DATA"}{"rs":"RELAY001_DATA:0 1"}'
    assert classify_window(concat) == "V1"


def test_mp5000_scale_and_forbidden():
    c = build_mp5000(0, 20.3, 100)
    assert c["rs"] == "MP5000_Trama_Write(0,20.3,100)"
    assert c["scaled"] == 2030.0
    line = encode_line(c["payload"])
    assert line.endswith("\r\n")
    assert '"rs":"MP5000_Trama_Write(0,20.3,100)"' in line
    try:
        build_mp5000(7, 1, 1)
        raise AssertionError("idx 7 debe fallar")
    except ValueError:
        pass


def test_relay_and_pot():
    r = build_relay("1111111110")
    assert r["rs"] == "RELAY001_SET_RELE(1111111110)_"
    assert r["relays_on"] == [10]
    r2 = build_relay([0, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    assert r2["rs"].startswith("RELAY001_SET_RELE(0111111111)_")
    p = build_pot(500)
    assert p["rs"] == "RELAY001_SET_POT(500)_"
    assert p["volts"] == 5.0


if __name__ == "__main__":
    test_window_v1_and_close()
    test_mp5000_scale_and_forbidden()
    test_relay_and_pot()
    print("ok")
