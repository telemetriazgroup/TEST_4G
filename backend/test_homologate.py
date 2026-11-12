"""Criterios de aceptación de datos_homologar.md (sin Mongo / HTTP)."""

from datetime import datetime, timedelta, timezone

import control as ctrl
from homologate import (
    FrameAssembler,
    LevelGuard,
    build_standard,
    classify_frame,
    date_key,
    history_window,
    hour_key,
    pget_level,
    split_json_objects,
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
            "text": "CONNECT 1.2.3.4:1 → 9917",
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


def test_pget_level_is_field_12():
    text = (
        '869387065279607{"i":"MAD000","rs":"PGet:21.5,21.6,18.7,0.0,0.0,22.0,22.7,'
        '92.0,70.0,2.6,0.3,119.5,150,40,2"}'
    )
    assert pget_level(text) == 119.5
    assert pget_level("869387065279607PGet") is None


def test_level_guard_replaces_spike_with_slope():
    guard = LevelGuard()
    base = datetime(2026, 11, 12, 0, 32, tzinfo=timezone.utc)
    seen = []
    for i, raw in enumerate((118.2, 118.1, 117.5, 915.8, 118.2)):
        ts = base + timedelta(seconds=35 * i)
        seen.append(guard.feed(ts, raw))
    assert seen[0]["reason"] == "ok" and seen[0]["value"] == 118.2
    assert seen[2]["corrected"] is False
    assert seen[3]["corrected"] is True
    assert seen[3]["reason"] == "above_max"
    assert seen[3]["value"] is not None and seen[3]["value"] < 350
    assert abs(seen[3]["value"] - 117.0) < 2
    assert seen[4]["corrected"] is False
    assert seen[4]["value"] == 118.2


def test_level_guard_keeps_a_real_dose_step():
    guard = LevelGuard()
    base = datetime(2026, 11, 12, 3, 38, tzinfo=timezone.utc)
    values = (115.1, 115.1, 115.7, 122.9)
    out = [guard.feed(base + timedelta(seconds=35 * i), v) for i, v in enumerate(values)]
    assert all(not row["corrected"] for row in out)
    assert out[-1]["value"] == 122.9


def test_level_guard_ignores_spike_before_slope():
    guard = LevelGuard()
    ts = datetime(2026, 11, 12, 0, 0, tzinfo=timezone.utc)
    first = guard.feed(ts, 915.8)
    assert first["corrected"] is True
    assert first["value"] is None
    second = guard.feed(ts + timedelta(seconds=35), 114.9)
    assert second["value"] == 114.9
    assert second["corrected"] is False


D1 = "1B0204000082A700AA"
D2 = "1B0204000082A701BB"
IMEI = "869387065279607"


def _semi(field: str, value: str) -> str:
    return f'{IMEI}{{"i":"MAD000","{field}";"{value}"}}'


def test_group_posts_termoking_shape():
    asm = FrameAssembler()
    t0 = datetime(2026, 11, 12, 0, 0, 28, tzinfo=timezone.utc)
    assert asm.push(t0, _semi("d02", D2), None) is None
    assert asm.push(t0 + timedelta(seconds=2), _semi("d01", D1), None) is None
    payload = asm.push(
        t0 + timedelta(seconds=10),
        f'{IMEI}{{"i":"MAD000","rs":"PGet:1"}}',
        114.6,
    )
    assert payload == {
        "i": IMEI,
        "d1": D1,
        "d2": D2,
        "d3": "1 32516 1051 0 0 0 114.6",
        "d4": "UNIT111",
    }


def test_group_does_not_mix_after_20s():
    asm = FrameAssembler()
    t0 = datetime(2026, 11, 12, tzinfo=timezone.utc)
    asm.push(t0, _semi("d01", D1), None)
    asm.push(t0, _semi("d02", D2), None)
    assert asm.push(t0 + timedelta(seconds=25), f"{IMEI}PPM:1", 114.6) is None


def test_control_doses_only_below_two_percent():
    state, hit = ctrl.decide(None, now=1_000.0, level=120.0, setpoint=130.0)
    assert hit["send"] is True
    assert hit["tx"].startswith("RELE(1,")
    assert 1 <= hit["n"] <= 20
    assert state.get("last_dose_t") is None
    state = ctrl.commit_tx({**state, "pending": {"n": hit["n"], "tx": hit["tx"]}}, 1_000.0)
    _, near = ctrl.decide(state, now=1_200.0, level=129.0, setpoint=130.0)
    assert near["send"] is False
    _, above = ctrl.decide(None, now=1_000.0, level=131.0, setpoint=130.0)
    assert above["send"] is False
    _, wait = ctrl.decide(state, now=1_030.0, level=119.0, setpoint=130.0)
    assert wait["send"] is False
    assert "espera" in wait["reason"]


def test_control_gap_is_configurable():
    state, hit = ctrl.decide(None, now=1_000.0, level=110.0, setpoint=130.0)
    assert hit["send"] is True
    state = ctrl.commit_tx({**state, "pending": {"n": hit["n"], "tx": hit["tx"]}}, 1_000.0)
    _, blocked = ctrl.decide(state, now=1_150.0, level=114.0, setpoint=130.0, gap_s=200)
    assert blocked["send"] is False
    assert "200s" in blocked["reason"]
    _, free = ctrl.decide(state, now=1_150.0, level=114.0, setpoint=130.0, gap_s=60)
    assert free["send"] is True


def test_control_band_percent_is_configurable():
    _, wide = ctrl.decide(None, now=1_000.0, level=120.0, setpoint=130.0, band_pct=10)
    assert wide["send"] is False
    assert "10%" in wide["reason"]
    _, tight = ctrl.decide(None, now=1_000.0, level=129.0, setpoint=130.0, band_pct=0.5)
    assert tight["send"] is True
    _, any_drop = ctrl.decide(None, now=1_000.0, level=127.0, setpoint=130.0, band_pct=0)
    assert any_drop["send"] is True


def test_control_tx_only_after_server_get_and_ack():
    imei = "869387065279607"
    state, armed = ctrl.on_frame(
        None,
        now=1_000.0,
        text=f'{imei}{{"rs":"PGet:1"}}',
        level=120.0,
        setpoint=130.0,
    )
    assert armed["armed"] is True
    assert armed["send"] is False
    assert state["pending"]["tx"].startswith("RELE(1,")
    held, other = ctrl.on_frame(
        state,
        now=1_001.0,
        text=f"{imei}PPM:120.0",
        level=None,
        setpoint=130.0,
    )
    assert other is None
    assert held["pending"]["tx"] == state["pending"]["tx"]
    ready, order = ctrl.on_frame(
        held,
        now=1_002.0,
        text=f"{imei}Server_Get",
        level=None,
        setpoint=130.0,
    )
    assert order["kind"] == "tx"
    assert order["send"] is True
    assert order["tx"] == held["pending"]["tx"]
    sent = ctrl.commit_tx(ready, 1_002.0)
    assert "pending" not in sent
    assert sent["awaiting"]["n"] == order["n"]
    _, again = ctrl.on_frame(
        sent,
        now=1_008.0,
        text=f"{imei}Server_Get",
        level=None,
        setpoint=130.0,
    )
    assert again is None
    done, ack = ctrl.on_frame(
        sent,
        now=1_003.0,
        text=f"{imei}SET_RELE 1 -> {order['n']} OK",
        level=None,
        setpoint=130.0,
    )
    assert ack["ack"] is True
    assert ack["ack_text"] == f"SET_RELE 1 -> {order['n']} OK"
    assert "awaiting" not in done
    mismatch_state = ctrl.commit_tx(ready, 1_002.0)
    _, bad = ctrl.on_frame(
        mismatch_state,
        now=1_004.0,
        text=f"{imei}SET_RELE 1 -> 99 OK",
        level=None,
        setpoint=130.0,
    )
    assert bad["ack"] is False


def test_history_window_lima_hour():
    start, end = history_window("2026-11-11 19:00")
    assert start.startswith("2026-11-12T00:00:00")
    assert end.startswith("2026-11-12T01:00:00")


if __name__ == "__main__":
    test_split_concat_does_not_post_rs()
    test_forma_a_standard_payload()
    test_rs_and_header_skipped()
    test_forma_b_does_not_map_alarm_to_d02()
    test_hour_key_lima()
    test_pget_level_is_field_12()
    test_level_guard_replaces_spike_with_slope()
    test_level_guard_keeps_a_real_dose_step()
    test_level_guard_ignores_spike_before_slope()
    test_group_posts_termoking_shape()
    test_group_does_not_mix_after_20s()
    test_control_doses_only_below_two_percent()
    test_control_band_percent_is_configurable()
    test_control_gap_is_configurable()
    test_control_tx_only_after_server_get_and_ack()
    test_history_window_lima_hour()
    print("ok")
