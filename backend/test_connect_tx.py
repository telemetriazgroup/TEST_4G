from connect_tx import clean_ipv4, prepare_connect_message


def test_ip_and_message():
    assert clean_ipv4("190.187.158.12") == "190.187.158.12"
    try:
        clean_ipv4("190.187.158")
        raise AssertionError("ip corta")
    except ValueError:
        pass
    text, enc = prepare_connect_message("aa 55 01", "hex", False)
    assert text == "AA5501" and enc == "hex"
    text, enc = prepare_connect_message("AA55", "hex", True)
    assert text == "AA550D0A"
    text, enc = prepare_connect_message("hola", "string", True)
    assert text == "hola\r\n" and enc == "string"
    try:
        prepare_connect_message("ABC", "hex", False)
        raise AssertionError("hex impar")
    except ValueError:
        pass


if __name__ == "__main__":
    test_ip_and_message()
    print("ok")
