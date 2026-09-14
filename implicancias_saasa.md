# Implicancias SAASA (TCP 9911)

Rama **`test-saasa`**. Especificación: [caso_saasa.md](./caso_saasa.md). Trazas de referencia: [logica_comunicacion.json](./logica_comunicacion.json).

Este flujo **no** es la homologación POLLO (`82A7` → `d01/d02/d03`). Es un módulo aparte: consulta periódica + POST `{ i, d01, d02 }` + registro de cada envío.

---

## 1. Qué hay en el cable

Los 8 equipos **no** abren 8 sockets. En la captura hay **una** sesión TCP (`190.187.158.13` → **9911**). El gateway multiplexa las unidades con un string:

```text
SAASA_UNIT111_GET_DATA
SAASA_UNIT222_GET_DATA
…
SAASA_UNIT888_GET_DATA
```

La respuesta **no lleva el id de unidad**. Siempre es el sobre:

```json
{"i":"SAASA","rs":"<hex de telemetría>"}
```

Ejemplo UNIT888 (`logica_comunicacion.json`):

| Dir | ASCII |
|-----|--------|
| TX | `SAASA_UNIT888_GET_DATA` |
| RX | `{"i":"SAASA","rs":"161693C043C023C097…C5D0"}` |

El `i` del JSON de dispositivo es la marca (`SAASA`). El `i` que pide el API de destino es la **unidad** (`SAASA_UNIT888`). Mezclarlos rompe el alta.

---

## 2. Homologación (mapeo)

| Campo POST | Origen | Valor |
|------------|--------|--------|
| `i` | Unidad consultada (no el RX) | `SAASA_UNIT111` … `SAASA_UNIT888` |
| `d01` | Constante | `"SAASA"` |
| `d02` | Campo `rs` del RX | hex tal cual, sin recortar |

Destino: `POST http://161.132.53.51:9050/Starcool/`

```json
{
  "i": "SAASA_UNIT888",
  "d01": "SAASA",
  "d02": "161693C043C023C097C07BC6BBC023E003E003E003E0030000D60F8C0EBE1A090E14160CFE00FF00FF00FFFFFFFFFFFFFFFFFFFFFFFFD28600000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000C5D0"
}
```

Código: `backend/saasa.py` (`parse_rx`, `build_payload`). I/O: poller en `backend/main.py`.

---

## 3. Por qué las consultas van en serie

Si se mandaran las 8 `GET_DATA` a la vez, los RX `{i:SAASA, rs:…}` no se podrían atribuir. Implicación:

1. Armar waiter **antes** del TX.
2. Enviar `SAASA_UNITxxx_GET_DATA` por el socket vivo del bridge.
3. Esperar el siguiente RX parseable como sobre SAASA (timeout 12 s).
4. POST y registrar.
5. Pausa (`SAASA_GAP_S`, default 0,8 s) y pasar a la siguiente unidad.
6. Al terminar el ciclo, dormir el resto hasta **60 s** desde el inicio.

El IMEI de arranque (`869387065334238`) y los `GET_DATA` no se POST-ean.

En la traza UNIT888 tardó ~7 s. El timeout tiene que ser mayor que ese pico.

---

## 4. Ciclo de un minuto

- Intervalo: `SAASA_INTERVAL_S=60` (desde el **inicio** del ciclo, no desde el final).
- Si el ciclo dura más de 60 s (timeouts), el siguiente arranca al segundo siguiente.
- No se solapan ciclos (`409` si se pide uno manual en curso).
- Sin socket en el bridge: 8 registros `no_device`, sin POST.

---

## 5. Registro (módulo de envíos)

Colección Mongo **`saasa_envios`** (base `test_4g_9911`). Cada intento, con o sin POST, deja fila:

| Campo | Uso |
|-------|-----|
| `ts` | Inicio de la consulta |
| `cycle_id` | Ciclo (8 unidades comparten id) |
| `unit` / `command` | `SAASA_UNIT888` / `SAASA_UNIT888_GET_DATA` |
| `status` | `ok` · `error` · `timeout` · `no_device` · `send_failed` |
| `payload` | JSON exacto del POST |
| `http_status` / `http_body` / `error` | Resultado del API |
| `d02` / `rx_i` / `rx_ts` | `rs` y sobre recibido |
| `addr` `ip` `session_id` | Socket 9911 |
| `url` `host` | Destino |
| `source` | `poll` o `manual` |

UI superadmin: pestaña **SAASA** en serial `:8090`. API:

- `GET /api/saasa/status` — config, último por unidad, contadores
- `GET /api/saasa/envios` — historial filtrable (`status`, `unit`, `cycle_id`)
- `POST /api/saasa/cycle` — un ciclo ahora
- `GET /api/health` → `saasa.enabled` / `host` / `running`

La pestaña **Enviadas** sigue siendo POLLO (`homologate_log`). No mezclar.

---

## 6. Qué no debe pasar

| Riesgo | Efecto | Mitigación |
|--------|--------|------------|
| Consultas en paralelo | `d02` de una unidad en `i` de otra | Serie + waiter por unidad |
| Usar `i` del RX (`SAASA`) en el POST | El API no identifica la cámara | `build_payload(unit, rs)` |
| Reutilizar homologación POLLO | POST con `d01=UNIT111` y opcodes `82A7` | URL POLLO vacía; `classify_frame` ignora este sobre (`status_rs`) |
| `port_cleaner` 9911 contra otro stack | Baja pollo/carne/starcool | `CLEAN_PORT=9911` y `name: test_4g_saasa` |
| Git checkout en esta carpeta a otra rama | Los archivos dejan de ser 9911; Docker no se aísla solo | [ram_tcp.md](./ram_tcp.md) |
| Timeout corto | UNIT888 queda `timeout` y no hay POST | ≥ 12 s (pico ~7 s en la traza) |
| API destino caído | `status=error`, se reintenta 3 veces, queda registro | No se bloquea el TCP: el POST es async tras persistir RX |
| Dos gateways en `/devices` | Se usa el primero | Un socket multiplexado, como la traza |

El POST **no** se hace en el hilo del `recv` del bridge. Primero se guarda la trama en `messages`; el waiter despierta; luego HTTP.

---

## 7. Entorno (`test-saasa`)

| Recurso | Valor |
|---------|--------|
| Rama / Compose | `test-saasa` / `test_4g_saasa` |
| TCP | **9911** |
| Backend | 9082 |
| Serial | 8090 |
| Mongo | `test_4g_9911` · `saasa_envios` |
| `SAASA_URL` | `http://161.132.53.51:9050/Starcool/` |
| `SAASA_ENABLED` | `1` |
| `SAASA_UNITS` | UNIT111 … UNIT888 |

Kill-switch: `SAASA_ENABLED=0` (el poller no consulta). El serial 9911 sigue igual.

---

## 8. Verificación

```bash
curl -sS http://localhost:9082/api/health
# saasa.enabled true, host 161.132.53.51:9050, db test_4g_9911

curl -sS http://localhost:9082/api/saasa/status
curl -sS 'http://localhost:9082/api/saasa/envios?limit=20'
```

Con equipo en 9911: serial muestra TX `SAASA_UNITxxx_GET_DATA` y RX `{"i":"SAASA","rs":…}`. La pestaña SAASA debe pasar a `POST OK` o `Error API` (nunca silencioso).

Sin equipo: cada minuto aparecen 8 filas `no_device`. Eso confirma el reloj, no el API.
