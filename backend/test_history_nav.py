"""El archivo por día usa la fecha de Lima y la IP, no el puerto efímero."""

from history_nav import calendar_fields, history_query, ip_of, lima_bounds, scope_query


def test_evening_lima_stays_on_the_local_day():
    # 20:00 en Lima es 01:00 UTC del día siguiente. El recorte UTC lo perdía.
    ts = "2026-10-17T01:00:00+00:00"
    fields = calendar_fields(ts)
    assert fields["day"] == "2026-10-16"
    assert fields["hour"] == "2026-10-16 20:00"
    start, end = lima_bounds("2026-10-16")
    assert start <= ts < end


def test_scope_follows_the_ip_across_reconnects():
    assert ip_of("181.65.10.4:54321") == "181.65.10.4"
    assert scope_query(addr="181.65.10.4:54321") == {"ip": "181.65.10.4"}
    query = history_query(addr="181.65.10.4:9999", date="2026-10-16")
    assert query["ip"] == "181.65.10.4"
    assert query["$or"][0] == {"day": "2026-10-16"}


def test_hour_window_is_one_local_hour():
    start, end = lima_bounds(hour="2026-10-16 20:00")
    assert start == "2026-10-17T01:00:00+00:00"
    assert end == "2026-10-17T02:00:00+00:00"


if __name__ == "__main__":
    test_evening_lima_stays_on_the_local_day()
    test_scope_follows_the_ip_across_reconnects()
    test_hour_window_is_one_local_hour()
    print("ok")
