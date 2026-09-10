from reglas import build_if, build_program, token_endif, token_else


def test_example_supply_gt_22_relay1_5s():
    r = build_if("Suministro", "MAYOR  (>)", 22.0, "RELAY1", 0, 5, False, "DEC")
    assert r["codigo"] == "50105802202000000005"
    prog = build_program(
        [
            {
                "tipo": "if",
                "entrada": "Suministro",
                "operador": "MAYOR  (>)",
                "valor": 22.0,
                "salida": "RELAY1",
                "estado": 0,
                "tiempo": 5,
            }
        ]
    )
    assert prog["rs"] == "PANTALLA_CMD:50105802202000000005"
    assert prog["timed"] is True
    assert prog["ok"] is True


def test_else_endif_and_balance():
    items = [
        {
            "tipo": "if",
            "entrada": "Retorno",
            "operador": "MENOR  (<)",
            "valor": 10,
            "salida": "RELAY2",
            "estado": 1,
            "tiempo": 3,
        },
        token_else(),
        token_endif(),
    ]
    prog = build_program(items)
    assert prog["ok"]
    assert prog["hex"].endswith("5351")
    empty = build_program([])
    assert empty["ok"] is False


if __name__ == "__main__":
    test_example_supply_gt_22_relay1_5s()
    test_else_endif_and_balance()
    print("ok")
