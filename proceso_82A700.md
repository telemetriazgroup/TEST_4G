# Proceso de decodificación 82A700 (Sensor readout)

Cómo pasar la trama hex POLLO / estándar `d01`/`d02` (opcode `82A700`) a un JSON de sensores, según el manual (CRC §3.2.1, marco §3.2.2–3.3, dataset §4.3.2).

Trama de trabajo:

```
1B0204000082A700F800FE7F0601EA007401EF01FF7F0401080109010A010D014700FE7FFE7FFE7F
C5013C00360034003800FE7FFE7F3C00010029032E0F00009A020000456B0B00FE7FFE7FF6000601
FE7F0000CC002000FE7FFF7FFE7FFE7FA6AD1B04
```

En el flujo actual esta hex es el **Sensor readout** (`equivalencia.md`). En forma A llega como POLLO `d01` y se homologa a estándar `d02`. Este documento decodifica **ese bloque hex**, no el JSON POLLO completo.

---

## 1. Envoltorio del telegrama

| Offset | Campo | Valor fijo | Rol |
|--------|--------|------------|-----|
| 0 | ESC | `1B` | Inicio |
| 1 | SOF | `02` | Start of frame |
| 2 | FT | `04` | Frame type |
| 3 | TA | `00` | Target address |
| 4 | FA | `00` | Fonte address |
| 5 | Format | `82` | Telegrama de sistema |
| 6 | Command / Reply | `A7` | Sensor readout |
| 7 | Subcommand | `00` | **Reply** (el pedido usa subcomando `10`) |
| 8 … N-4 | Data | 16-bit LE (y 32-bit en kWh) | Sensores |
| N-3 | CRC Hi | | CCITT 16 |
| N-2 | CRC Lo | | |
| N-1 | ESC | `1B` | |
| N | EOF | `04` | |

Pedido vs respuesta:

| | Format | Command | Sub |
|--|--------|---------|-----|
| Command (4.3.2.1) | `82` | `A7` | `10` |
| Reply (4.3.2.2) | `82` | `A7` | `00` |

Por eso el identificador de la respuesta es `82A700`, no `82A710`.

En la muestra: 100 bytes = 5 (ESC…FA) + 3 (`82A700`) + **88** data + 2 CRC (`A6AD`) + 2 (`1B04`).

El mapa oficial llega al byte de data **83** (84 bytes). Sobran **84–87** = `FE7F FE7F` (N/A, N/A): reservados o revisión posterior. El programa debe aceptarlos sin fallar.

---

## 2. CRC (obligatorio antes de traducir)

Algoritmo del manual §3.2.1: CCITT 16 bit (`X^16 + X^12 + X^5 + 1`).

```
Crc = (uint8)(Crc >> 8) | (Crc << 8);
Crc ^= Serdata;
Crc ^= (uint8)(Crc & 0xFF) >> 4;
Crc ^= (Crc << 8) << 4;
Crc ^= ((Crc & 0xFF) << 4) << 1;
```

**Rango comprobado** (esta trama y el ejemplo Get Product Information `1B020400000201FF451B04`):

- Inicializar `Crc = 0`
- Alimentar desde **FT** (offset 2) hasta el **último byte de data** (no CRC, no ESC/EOF final)
- El resultado se guarda **CRC Hi, CRC Lo** (big-endian del uint16)

Si el CRC no coincide: no decodificar; marcar `crc_ok: false`.

---

## 3. Números: little-endian + Fp + códigos especiales

Regla del dataset §4.3.2.3:

- Entero **16 bit**, **LO luego HI**.
- `Fp1` = exponente 0 → 123 = 123
- `Fp10` = exponente −1 → 123 = 12,3
- `Fp100` = exponente −2 → 123 = 1,23

**No interpretar como temperatura con signo un valor ≥ `0x7FF0`.** En hex de la trama se ve al revés (`FE7F` = `0x7FFE`).

| Raw (uint16) | Significado | `value` |
|--------------|-------------|---------|
| `0x7FFF` | Sensor initializing | `null` |
| `0x7FFE` | N/A | `null` |
| `0x7FFD` | Sensor error | `null` |
| `0x7FFC` | Sensor open | `null` |
| `0x7FFB` | Sensor short | `null` |
| `0x7FFA` | Sensor above | `null` |
| `0x7FF9` | Sensor below | `null` |
| `0x7FF8` | Sensor no comm | `null` |
| `0x7FF7` | Sensor warmup | `null` |
| `0x7FEF` | Máximo numérico válido | — |
| `< 0x7FF0` | int16 con signo × 10^exp | número |

Temperaturas negativas: p. ej. `38 FF` → `0xFF38` = −200 → Fp10 = **−20,0 °C**. Si se leyera unsigned o se tomara `FE7F` como int16 (−2), se inventarían −0,2 °C en sensores que **no existen**.

Campos 52–55, 56–59 y 60–63 son **rangos de 4 bytes** (acumuladores). Tratarlos como **uint32 LE** con el mismo Fp. En la muestra: 388,6 kWh, 66,6 kWh, 748357 s (~8,7 días) — coherente. Como int16 quedarían basura (`0x0F2E` + `0x0000`).

---

## 4. Mapa de sensores (offset **dentro del data**, después de `82A700`)

| Bytes | Campo JSON | Fp | Unidad |
|-------|------------|----|--------|
| 0–1 | `supply1_air_temp` | 10 | °C |
| 2–3 | `supply2_air_temp` | 10 | °C |
| 4–5 | `return_air_temp` | 10 | °C |
| 6–7 | `evaporator1_coil_temp` | 10 | °C |
| 8–9 | `condenser_coil_temp` | 10 | °C |
| 10–11 | `compressor_coil_temp` | 10 | °C |
| 12–13 | `compressor2_coil_temp` | 10 | °C |
| 14–15 | `ambient_air_temp` | 10 | °C |
| 16–17 | `cargo1_temp` | 10 | °C |
| 18–19 | `cargo2_temp` | 10 | °C |
| 20–21 | `cargo3_temp` | 10 | °C |
| 22–23 | `cargo4_temp` | 10 | °C |
| 24–25 | `relative_humidity` | 1 | % |
| 26–27 | `avlv` | 1 | CMH |
| 28–29 | `suction_pressure` | 100 | bar rel |
| 30–31 | `discharge_pressure` | 100 | bar rel |
| 32–33 | `line_voltage` | 10 | V |
| 34–35 | `line_frequency` | 1 | Hz |
| 36–37 | `current_ph1` | 10 | A |
| 38–39 | `current_ph2` | 10 | A |
| 40–41 | `current_ph3` | 10 | A |
| 42–43 | `co2` | 10 | % |
| 44–45 | `o2` | 10 | % |
| 46–47 | `evaporator_fan_speed` | 1 | % |
| 48–49 | `condenser_fan_speed` | 1 | % |
| 50–51 | `datalogger_battery_voltage` | 10 | V |
| 52–55 | `power_meter_reading` | 10 | kWh (u32) |
| 56–59 | `power_meter_trip_reading` | 10 | kWh (u32) |
| 60–63 | `power_meter_trip_duration` | 1 | s (u32) |
| 64–65 | `suction_temp` | 10 | °C (calculada) |
| 66–67 | `discharge_temp` | 10 | °C (calculada) |
| 68–69 | `supply_air_temp_showoff` | 10 | °C |
| 70–71 | `return_air_temp_showoff` | 10 | °C |
| 72–73 | `dl_battery_temp` | 100 | °C |
| 74–75 | `dl_battery_charge_current` | 100 | A |
| 76–77 | `power_consumption` | 100 | kWh |
| 78–79 | `power_consumption_avg_per_hour` | 100 | kW·h |
| 80–81 | `suction2_pressure` | 100 | bar rel |
| 82–83 | `suction2_temp` | 10 | °C |
| 84–87 | `reserved` | — | si vienen, casi siempre N/A |

Note 1/2 del manual: succión/descarga (64–67) son **calculadas**; supply/return (68–71) son **show-off** (segunda vía / display).

---

## 5. Traducción de la trama de ejemplo

Valores coherentes con un equipo en marcha (aire ~25 °C, 60 Hz, ~5 A/fase, RH 71 %).

```json
{
  "opcode": "82A700",
  "crc_ok": true,
  "crc": "A6AD",
  "sensors": {
    "supply1_air_temp": { "value": 24.8, "unit": "°C", "status": "ok" },
    "supply2_air_temp": { "value": null, "unit": "°C", "status": "na" },
    "return_air_temp": { "value": 26.2, "unit": "°C", "status": "ok" },
    "evaporator1_coil_temp": { "value": 23.4, "unit": "°C", "status": "ok" },
    "condenser_coil_temp": { "value": 37.2, "unit": "°C", "status": "ok" },
    "compressor_coil_temp": { "value": 49.5, "unit": "°C", "status": "ok" },
    "compressor2_coil_temp": { "value": null, "unit": "°C", "status": "initializing" },
    "ambient_air_temp": { "value": 26.0, "unit": "°C", "status": "ok" },
    "cargo1_temp": { "value": 26.4, "unit": "°C", "status": "ok" },
    "cargo2_temp": { "value": 26.5, "unit": "°C", "status": "ok" },
    "cargo3_temp": { "value": 26.6, "unit": "°C", "status": "ok" },
    "cargo4_temp": { "value": 26.9, "unit": "°C", "status": "ok" },
    "relative_humidity": { "value": 71, "unit": "%", "status": "ok" },
    "avlv": { "value": null, "unit": "CMH", "status": "na" },
    "suction_pressure": { "value": null, "unit": "bar", "status": "na" },
    "discharge_pressure": { "value": null, "unit": "bar", "status": "na" },
    "line_voltage": { "value": 45.3, "unit": "V", "status": "ok" },
    "line_frequency": { "value": 60, "unit": "Hz", "status": "ok" },
    "current_ph1": { "value": 5.4, "unit": "A", "status": "ok" },
    "current_ph2": { "value": 5.2, "unit": "A", "status": "ok" },
    "current_ph3": { "value": 5.6, "unit": "A", "status": "ok" },
    "co2": { "value": null, "unit": "%", "status": "na" },
    "o2": { "value": null, "unit": "%", "status": "na" },
    "evaporator_fan_speed": { "value": 60, "unit": "%", "status": "ok" },
    "condenser_fan_speed": { "value": 1, "unit": "%", "status": "ok" },
    "datalogger_battery_voltage": { "value": 80.9, "unit": "V", "status": "ok" },
    "power_meter_reading": { "value": 388.6, "unit": "kWh", "status": "ok" },
    "power_meter_trip_reading": { "value": 66.6, "unit": "kWh", "status": "ok" },
    "power_meter_trip_duration": { "value": 748357, "unit": "s", "status": "ok" },
    "suction_temp": { "value": null, "unit": "°C", "status": "na" },
    "discharge_temp": { "value": null, "unit": "°C", "status": "na" },
    "supply_air_temp_showoff": { "value": 24.6, "unit": "°C", "status": "ok" },
    "return_air_temp_showoff": { "value": 26.2, "unit": "°C", "status": "ok" },
    "dl_battery_temp": { "value": null, "unit": "°C", "status": "na" },
    "dl_battery_charge_current": { "value": 0.0, "unit": "A", "status": "ok" },
    "power_consumption": { "value": 2.04, "unit": "kWh", "status": "ok" },
    "power_consumption_avg_per_hour": { "value": 0.32, "unit": "kWh", "status": "ok" },
    "suction2_pressure": { "value": null, "unit": "bar", "status": "na" },
    "suction2_temp": { "value": null, "unit": "°C", "status": "initializing" }
  }
}
```

`line_voltage` 45,3 V y `datalogger_battery_voltage` 80,9 V siguen el Fp del manual; hay que **validar en campo**. No cambiar la escala sin otra página del manual.

---

## 6. Implicancias

1. **Homologación no decodifica.** El POST estándar manda el hex crudo (`d02` = este bloque). Este proceso es un **segundo paso** (monitor, API interna, analítica).
2. **`FE7F` / `FF7F` no son temperaturas.** Tratarlos como número rompe umbrales y gráficas.
3. **CRC:** un hex cortado o dos JSON pegados (`}{`) no se deben parsear como sensores.
4. **Localizar el bloque por opcode `82A700`**, no por el nombre `d01` (a veces `d01` es `82A706`).
5. **Longitud variable:** data < 84 → decodificar lo que alcance; data > 84 → extra como `reserved`.
6. **kWh 32-bit:** si se leen 16-bit, el medidor queda mal de un orden de magnitud.
7. **No mezclar con `INFO:24.6,23.5,…`** (eso es otro `rs`). Pueden correlacionarse después.
8. **Persistencia:** guardar JSON decodificado junto a la trama (p. ej. `messages.decoded_82a700` o colección `sensor_readouts`) para consultar sin reparsear.
9. **Programa aparte del POST:** un CRC o campo mal leído no debe impedir guardar ni encolar el hex estándar.

---

## 7. Programa necesario

Módulo único, sin I/O de red: `decode_82a700(hex) -> dict`.

```
hex string
  → bytes
  → validar 1B 02 … 1B 04
  → opcode == 82A700 (si no, reject; no es sensor)
  → CRC desde FT hasta data
  → para cada campo del mapa: LE + especial + Fp
  → JSON { opcode, crc_ok, sensors }
```

Funciones mínimas:

| Función | Rol |
|---------|-----|
| `crc16_ccitt_tk(data_from_ft) -> int` | Igual al C del §3.2.1 |
| `split_frame(raw) -> header, data, crc` | Cortes fijos |
| `u16le` / `u32le` | |
| `decode_fp(raw, exp) -> {value, status, raw}` | Códigos ≥ `0x7FF0` |
| `decode_82a700(hex) -> dict` | Orquestador |

Dónde engancharlo (fase 2, no bloquea 9910):

```
telemetry persistida
  → classify / opcode 82A700
  → decode_82a700
  → guardar decoded + opcional UI “Sensores”
```

No reescribir el POST de homologación. Tests: esta trama (CRC `A6AD`, supply1=24.8, RH=71, 60 Hz) y el ejemplo `0201` / `FF45`.

---

## 8. Relación con el resto

| Pieza | Relación |
|-------|----------|
| `equivalencia.md` | `82A700` = Sensor readout |
| `datos_homologar.md` | El hex viaja en estándar `d02`; esto **abre** ese hex |
| Histórico / Enviadas | Fuente del hex; el JSON de sensores es derivado |
| `82A701` / `702` / `703` / `706` | Otros mapas (control, IO, caption, alarmas); mismo envoltorio y CRC |

Siguiente implementación razonable: `backend/decode_82a700.py` + tests con esta trama, y un campo `decoded` en la pestaña Enviadas cuando el payload tenga `d02`/`82A700`.
