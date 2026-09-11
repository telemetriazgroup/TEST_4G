# Protocolo: nueva rama TCP con entorno propio

Cuando haga falta **otra interfaz / otro producto** sobre este repo, no se comparte el stack de `test_pollo` (9910) ni el de `test-saasa` (9911). Se crea **una rama + una carpeta + un TCP + una Mongo + un proyecto Compose**.

Por qué no se puede “solo cambiar de rama” en la misma carpeta: [multiples_puertos.md](./multiples_puertos.md).

---

## 1. Datos que hay que pedir (antes de tocar código)

| Dato | Ejemplo | Obligatorio |
|------|---------|-------------|
| Nombre de rama Git | `test-saasa`, `test_cliente_x` | Sí |
| Slug corto (solo `a-z0-9_`) | `saasa`, `cliente_x` | Sí |
| Offset `N` respecto a la base 9910 | `0`, `1`, `2`… | Sí |
| Carpeta de trabajo distinta | `/ruta/saasa/TEST_4G` | Sí (recomendado) |
| Rama de origen | `test_pollo` o `test-saasa` | Sí |

`N` = cuántos enteros sumar a **todos** los puertos de host de la tabla base. `N=0` es pollo. `N=1` es saasa. El siguiente libre suele ser `N=2` → TCP **9912**.

Antes de elegir `N`, en el servidor:

```bash
ss -lnt | grep -E '991[0-9]|808[1-9]|908[1-9]|844[4-9]|2901[7-9]'
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E '991|8089|8090|8444|8445|9081|9082'
```

Si el TCP o cualquier HTTP de la tabla ya está ocupado, subir `N` otra vez.

No usar **8443** (preview Figma de otro proyecto). El 27017 interno de Mongo **no se incrementa**.

---

## 2. Fórmula de puertos (base = `test_pollo`, N = 0)

| Recurso | Fórmula | N=0 pollo | N=1 saasa | N=2 siguiente |
|---------|---------|-----------|-----------|----------------|
| TCP dispositivo | `9910 + N` | 9910 | 9911 | 9912 |
| Bridge HTTP | `8081 + N` | 8081 | 8082 | 8083 |
| Backend | `9081 + N` | 9081 | 9082 | 9083 |
| Superadmin serial | `8089 + N` | 8089 | 8090 | 8091 |
| Ztrack | `8444 + N` | 8444 | 8445 | 8446 |
| Mongo host | `29017 + N` → 27017 | 29017 | 29018 | 29019 |
| Proyecto Compose `name:` | `test_4g_<slug>` | `test_4g_pollo` | `test_4g_saasa` | `test_4g_<slug>` |
| `MONGO_DB` | `test_4g_<TCP>` | `test_4g` | `test_4g_9911` | `test_4g_9912` |
| Volumen Compose | `mongo_data_<TCP>` | `mongo_data` | `mongo_data_9911` | `mongo_data_9912` |
| `CLEAN_PORT` | igual que TCP | 9910 | 9911 | 9912 |

`port_cleaner` solo debe matar contenedores de **ese** TCP, nunca el 9910 si esta rama es 9912.

---

## 3. Protocolo de trabajo (humano + agente)

1. **Carpeta nueva** (clone o copia). No reutilizar la carpeta donde ya corre otro `N`.
2. `git checkout -b <rama>` desde el origen acordado.
3. Aplicar la fórmula `N` en todos los archivos de la lista de la sección 4. Un reemplazo ciego de `9910` puede romper dumps JSON y tests de tramas: sustituir **archivo a archivo**, solo defaults y bind de red.
4. `name:` en `docker-compose.yml` = `test_4g_<slug>` (nunca dejar el default de carpeta `TEST_4G`).
5. Actualizar la tabla de [multiples_puertos.md](./multiples_puertos.md) con la rama nueva.
6. `docker compose up -d --build` **en esa carpeta**.
7. Verificar (sección 5). El equipo apunta al TCP nuevo.
8. No hacer `docker compose down` en otra carpeta “para limpiar”: baja **ese** entorno.

---

## 4. Archivos que hay que tocar

Runtime (obligatorio):

- `docker-compose.yml` — `name`, puertos, `CLEAN_PORT`, `TCP_PORT`, `HTTP_PORT`, `MONGO_DB`, volumen, `VITE_SERIAL_URL`, `BRIDGE_URL`, `BACKEND_URL`
- `backend/Dockerfile` — `EXPOSE` y `--port` del backend
- `backend/main.py` — default `MONGO_DB`, `BRIDGE_URL`, comentario de puerto TCP
- `tcp_bridge/Dockerfile` — `EXPOSE TCP HTTP`
- `tcp_bridge/bridge.py` — defaults `TCP_PORT`, `HTTP_PORT`, `BACKEND_URL`
- `port_cleaner/clean.sh` — default `CLEAN_PORT`
- `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/index.html`, `frontend/app.js` (`ZTRACK_URL`)
- `ztrack/Dockerfile`, `ztrack/nginx.conf`, `ztrack/vite.config.ts`, `ztrack/src/api.ts`, `ztrack/src/screens/Login.tsx`
- `test_9910.py` — solo defaults de env (el nombre del archivo se puede dejar)

Docs operativos: `README.md`, `contexto.md`, esta tabla en `multiples_puertos.md`.

No hace falta (y suele ser dañino) reescribir:

- JSON históricos (`historico_hora_*.json`)
- payloads `82A7xx` / hex de tests
- `27017` interno de Mongo

El serial **en vivo** no debe hidratarse con `GET /api/messages?limit=100` de toda la base: solo sesión actual del bridge. Si se copia código viejo de `test_pollo` que aún haga eso, corregirlo en la rama nueva.

---

## 5. Verificación (no declarar listo sin esto)

```bash
docker compose ps
curl -sS http://localhost:<BACKEND>/api/health
# debe verse "db": "test_4g_<TCP>" y messages acorde a ESTA rama (vacío si es entorno nuevo)

curl -sS http://localhost:<SERIAL>/
curl -sS http://localhost:<ZTRACK>/
ss -lnt | grep <TCP>
```

Los nombres de contenedor deben ser `test_4g_<slug>-backend-1`, no `test_4g-backend-1`.

Si `health.db` coincide con pollo o saasa, el entorno **no** está aislado.

---

## 6. Prompt para el agente (copiar y pegar)

Rellenar las líneas `…` y pegar el bloque tal cual.

```text
Sigue el protocolo de ram_tcp.md (TEST_4G). No improvises puertos.

Entrada:
- Rama Git: …
- Slug Compose (a-z0-9_): …
- Offset N: …
- Rama origen: …
- Carpeta de trabajo (absoluta): …

Haz esto, en orden:
1. Confirma que estás en esa carpeta y rama. Si el TCP 9910+N o algún puerto de la tabla de ram_tcp.md ya está ocupado en el host, PARA y propone N+1.
2. Aplica la fórmula de ram_tcp.md sección 2 a todos los archivos de la sección 4. Mongo interno se queda en 27017. No uses 8443. No reescribas dumps JSON ni hex 82A7.
3. docker-compose.yml debe tener name: test_4g_<slug>, MONGO_DB test_4g_<TCP>, volumen mongo_data_<TCP>, CLEAN_PORT = TCP.
4. Actualiza README.md, contexto.md y la tabla de entornos en multiples_puertos.md.
5. docker compose up -d --build en ESTA carpeta. No hagas down del otro entorno.
6. Verifica health.db, contenedores con prefijo test_4g_<slug>-, y que el TCP nuevo escucha.
7. Al terminar, entrega la tabla N de puertos y las URLs (serial, ztrack, backend).

Regla: una rama = una carpeta = un name Compose = un TCP = una Mongo. Git checkout no aísla Docker.
```

Ejemplo ya relleno (siguiente entorno, N=2):

```text
Sigue el protocolo de ram_tcp.md (TEST_4G). No improvises puertos.

Entrada:
- Rama Git: test_cliente_x
- Slug Compose: cliente_x
- Offset N: 2
- Rama origen: test-saasa
- Carpeta de trabajo: /home/ztrack/mongo/Proyectos/cliente_x/TEST_4G

… (resto igual al bloque de arriba)
```

Eso deja TCP **9912**, serial **8091**, Ztrack **8446**, backend **9083**, Mongo host **29019**, `name: test_4g_cliente_x`, base `test_4g_9912`.
