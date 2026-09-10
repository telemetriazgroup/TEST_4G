from client_api import build_live, build_series


def test_live_co2_percent_and_motors():
    latest = {
        "info": {
            "ts": "2026-09-10T01:00:00+00:00",
            "snapshot": {
                "supply_air_c": 23.4,
                "return_air_c": 25.1,
                "setpoint_c": 24.0,
                "usda1_c": 24.1,
                "usda2_c": 24.2,
                "usda3_c": 24.0,
                "usda4_c": 24.3,
                "co2_pct": 0.35,
                "humidity_pct": 58,
                "co2_setpoint_pct": 0.3,
                "humidity_setpoint_pct": 60,
            },
        },
        "relay": {
            "ts": "2026-09-10T01:00:01+00:00",
            "analogs": [
                {"id": 1, "volts": 8.0, "speed_pct": 80},
                {"id": 2, "volts": 7.8, "speed_pct": 78},
                {"id": 3, "volts": 8.0, "speed_pct": 80},
                {"id": 4, "volts": 8.2, "speed_pct": 82},
            ],
            "relays": [{"id": 1, "name": "libre", "on": False}],
        },
    }
    snap = build_live(latest, ident="POLLO_BEBE", online=True)
    assert snap["co2_pct"] == 0.35
    assert snap["zones"][0]["temp"] == 24.1
    assert len(snap["motors"]) == 4
    assert snap["ventilation_pct"] == 80.0
    assert "ppm" not in str(snap).lower()


def test_series_only_info():
    rows = [
        {"kind": "relay", "ts": "t0", "snapshot": {}},
        {"kind": "info", "ts": "t1", "snapshot": {"supply_air_c": 22, "co2_pct": 0.2}},
    ]
    out = build_series(rows, 6)
    assert out["count"] == 1
    assert out["points"][0]["co2_pct"] == 0.2


if __name__ == "__main__":
    test_live_co2_percent_and_motors()
    test_series_only_info()
    print("ok")
