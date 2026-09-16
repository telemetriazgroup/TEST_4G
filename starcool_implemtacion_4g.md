# Starcool 4G — implementación (TCP 9914)

Rama **`test-starcool`**. Caso: [caso_starcool.md](./caso_starcool.md).

Este flujo **no** es homologación POLLO (`82A7`) ni el poller SAASA (`GET_DATA` / `d01=SAASA`). Es un módulo propio: poll hex por **sesión TCP**, corte IMEI + payload, POST `{ i, d01: METRO, d02 }` y registro indexado por IMEI.

---

## 1. Qué hay en el cable

Varias sesiones pueden estar vivas a la vez en **9914**. Cada una es un equipo (no un gateway de 8 unidades).

Secuencia de la captura:

```text
HDR  CONNECT 190.187.158.14:28753 → 9914
TX   HEX  161613ffffffff8457
RX   HEX  383639333837303635333334313838161693c003c0…0883
          ASCII 869387065334188…
HDR  DISCONNECT …
```

El TX es **siempre el mismo hex**, cada minuto, a **cada** `addr` conectado.

El RX se parte en el marcador `161693` (no confundir con el TX `161613`):

| Sector | Hex (traza serial) | Uso |
|--------|--------------------|-----|
| 1 | `383639333837303635333334313838` | bytes → ASCII IMEI `869387065334188` |
| 2 | desde `161693` hasta el final | `d02` |

En el markdown del caso el primer sector aparece como `363933…` (falta el `38` inicial). El parseo **no** usa un largo fijo: busca el primer `161693`. Si el IMEI no queda en 15 dígitos, no hay POST (`parse_error`).

---

## 2. JSON hacia el API

`POST http://161.132.53.51:9050/Starcool/`

```json
{
  "i": "869387065334188",
  "d01": "METRO",
  "d02": "161693c003c003c003c013c60bc007c007c007c00be0030000db0d8c0eff1a091010370cfe00ff00ff00ffffffffffffffffffffffff000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000883"
}
```

- `i` = IMEI (sector 1), no un id de unidad inventado.
- `d01` = constante `METRO`.
- `d02` = sector 2 en minúsculas, sin recortar.

---

## 3. Por qué no se copia SAASA

| | SAASA 9911 | Starcool 9914 |
|---|------------|----------------|
| Socket | 1 gateway, 8 lógicos | N sesiones, 1 equipo cada una |
| TX | string `SAASA_UNIT…_GET_DATA` | hex `161613ffffffff8457` |
| RX | `{"i":"SAASA","rs":…}` sin unidad | IMEI en el propio RX |
| Waiter | uno global (serie) | **uno por `addr`** |
| Clave registro | `SAASA_UNITxxx` | **IMEI (`i`)** |

Un waiter global mezclaría dos IPs. El poll de dos sesiones corre en paralelo (tope de concurrencia).

---

## 4. Flujo

```text
cada 60 s
  GET bridge /devices          ← solo sockets vivos
  para cada addr (pool):
      waiter[addr] ANTES del TX
      POST /send encoding=hex  161613ffffffff8457
      espera RX de ESE addr (timeout)
      parse → { i, d01: METRO, d02 }
      POST API Starcool
      insert starcool_envios
```

El POST al API de Lima **no** corre en el `recv` del bridge: primero se persiste el RX en `messages`, el waiter despierta, después HTTP.

El TX debe ir en **hex**. Mandarlo como string ASCII no es la misma trama.

---

## 5. Código

| Pieza | Rol |
|-------|-----|
| `backend/starcool.py` | Parseo puro, env, payload, hash |
| `backend/test_starcool.py` | Trama de la captura |
| `backend/main.py` | Poller, waiters por addr, POST, API |
| Colección `starcool_envios` | Un doc por intento |
| UI pestaña **Starcool** (`:8093`) | Último por IMEI + historial |
| `GET /api/starcool/status` | Config, sesiones, contadores |
| `GET /api/starcool/envios?i=` | Historial filtrable |
| `POST /api/starcool/cycle` | Ciclo manual |

Estados: `ok` · `error` · `timeout` · `parse_error` · `send_failed` · `skip_duplicate`.

Sin equipos en el bridge: el ciclo no inventa filas; `status.running` / `last_cycle` lo dejan anotado (`sessions=0`).

Deduplicado POST: mismo `{i,d02}` con `ok` en los últimos `STARCOOL_DEDUP_S` (default 30 s) → no re-POST (reconexión + poll doble). El minuto siguiente sí, si cambió o ya pasó la ventana.

La pestaña **Enviadas** sigue siendo POLLO. `classify_frame` ignora este RX (no hay `d0x`).

---

## 6. Entorno

| Variable | Default |
|----------|---------|
| `STARCOOL_ENABLED` | `1` |
| `STARCOOL_URL` | `http://161.132.53.51:9050/Starcool/` |
| `STARCOOL_INTERVAL_S` | `60` |
| `STARCOOL_RX_TIMEOUT_S` | `8` |
| `STARCOOL_POST_TIMEOUT_S` | `8` |
| `STARCOOL_POST_RETRIES` | `3` |
| `STARCOOL_DEDUP_S` | `30` |
| `STARCOOL_POLL_CONCURRENCY` | `5` |
| `STARCOOL_TX_HEX` | `161613ffffffff8457` |
| `STARCOOL_D01` | `METRO` |

Stack: Compose `test_4g_starcool`, TCP **9914**, backend **9085**, serial **8093**, Mongo `test_4g_9914`. `CLEAN_PORT=9914`. No bajar pollo/saasa/carne.

Kill-switch: `STARCOOL_ENABLED=0`.

---

## 7. Verificación

```bash
curl -sS http://localhost:9085/api/health
# db test_4g_9914 · starcool.enabled true · host 161.132.53.51:9050

curl -sS http://localhost:9085/api/starcool/status
curl -sS 'http://localhost:9085/api/starcool/envios?limit=20'
```

Con equipo en 9914: serial muestra TX hex `161613ffffffff8457` y RX `38…161693…`. La pestaña Starcool debe pasar a `POST OK` o `Error API` (nunca silencioso). Superadmin: http://localhost:8093
