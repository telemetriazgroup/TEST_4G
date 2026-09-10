from decode_rs import decode_info, decode_relay, decode_rs_text

INFO = '{"i":"POLLO_BEBE","rs":"INFO:24.1,23.3,22.0,23.0,22.8,22.8,22.8,0.1,80.0,12.5,95.0"}'
RELAY = '{"i":"POLLO_BEBE","rs":"RELAY001_DATA:1 0 1 1 1 1 1 1 0 0 ,10.1,9.9,10.0,10.2,80.0,95.0"}'


def test_info_screen():
    st = decode_rs_text(INFO)[0]
    assert st["kind"] == "info"
    assert st["i"] == "POLLO_BEBE"
    s = st["snapshot"]
    assert s["supply_air_c"] == 24.1
    assert s["return_air_c"] == 23.3
    assert s["setpoint_c"] == 22.0
    assert s["usda1_c"] == 23.0
    assert s["co2_pct"] == 0.1
    assert s["humidity_pct"] == 80.0
    assert s["co2_setpoint_pct"] == 12.5
    assert s["humidity_setpoint_pct"] == 95.0


def test_info_without_humidity_sp():
    st = decode_info("24.6,23.5,22.0,23.9,24.0,24.0,24.0,0.0,67.0,12.5")
    assert st["snapshot"]["co2_setpoint_pct"] == 12.5
    assert st["snapshot"]["humidity_setpoint_pct"] is None


def test_relay_inverted_and_names():
    st = decode_rs_text(RELAY)[0]
    assert st["kind"] == "relay"
    assert st["source"] == "RELAY001_DATA"
    assert st["node"] == 1
    r = st["relays"]
    assert r[0]["name"] == "libre"
    assert r[0]["on"] is False
    assert r[1]["name"] == "libre"
    assert r[1]["on"] is True
    assert r[2]["name"] == "renovacion de aire off"
    assert r[8]["name"] == "Aire"
    assert r[8]["on"] is True
    assert r[9]["name"] == "Agua"
    assert r[9]["on"] is True
    assert st["analogs"][0]["volts"] == 10.1
    assert st["analogs"][0]["speed_pct"] == 101.0
    assert st["humidity_pct"] == 80.0
    assert st["humidity_setpoint_pct"] == 95.0


def test_relay_custom_name():
    st = decode_relay("0 1 1 1 1 1 1 1 1 1,1.0,2.0,3.0,4.0", node=2, relay_names={1: "compresor"})
    assert st["source"] == "RELAY002_DATA"
    assert st["relays"][0]["name"] == "compresor"
    assert st["relays"][0]["on"] is True
    assert st["humidity_pct"] is None


def test_skips_get_data():
    assert decode_rs_text('{"i":"POLLO_BEBE","rs":"RELAY001_GET_DATA"}') == []


if __name__ == "__main__":
    test_info_screen()
    test_info_without_humidity_sp()
    test_relay_inverted_and_names()
    test_relay_custom_name()
    test_skips_get_data()
    print("ok")
