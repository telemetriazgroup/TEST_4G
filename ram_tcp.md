# Protocolo: nueva rama TCP con entorno propio

Cuando haga falta **otra interfaz / otro producto** sobre este repo, no se comparte el stack de `test_pollo` (9910) ni el de `test-saasa` (9911). Se crea **una rama + una carpeta + un TCP + una Mongo + un proyecto Compose**.

Por qué no se puede “solo cambiar de rama” en la misma carpeta: [multiples_puertos.md](./multiples_puertos.md).

---

## 1. Datos que hay que pedir (antes de tocar código)

| Dato | Ejemplo | Obligatorio |
|------|---------|-------------|
| Nombre de rama Git | `test-saasa`, `test_cliente_x` | Sí |
| Slug corto (solo `a-z0-9_`) | `saasa`, `cliente_x` | Sí |
| Offset `N` respecto a la base 9910 | `0`, `1`, `2`… | Sí (TCP / Ztrack / Mongo host) |
| Offset `K` HTTP nuevo | `0` = gasificado | Sí en ramas **nuevas** (serial/backend/bridge) |
| Carpeta de trabajo distinta | `/ruta/saasa/TEST_4G` | Sí (recomendado) |
| Rama de origen | `test_pollo` o `test-saasa` | Sí |

`N` = offset del **TCP** (y de Mongo host / Ztrack) respecto a la base 9910.

`K` = offset HTTP **nuevo** (serial / backend / bridge). Empieza en **0** en `test-gasificado`. Las ramas ya creadas **no** se remapean.

| N | Rama | TCP |
|---|------|-----|
| 0 | `test_pollo` | 9910 |
| 1 | `test-saasa` | 9911 |
| 2 | `test-carne` | 9912 |
| 3 | `test-usa` | 9913 |
| 4 | `test-starcool` | 9914 |
| 5 | `test-tk` | 9915 |
| 6 | `test-gasificado` | **9916** |
| 11 | `test_usa_9921` | **9921** |

Antes de elegir `N`, en el servidor:

```bash
ss -lnt | grep -E '991[0-9]|196[0-9]{2}|197[0-9]{2}|198[0-9]{2}|844[4-9]|2901[7-9]|808[1-9]|908[1-9]'
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E '991|19600|19700|19800|8444|8445'
```

Si el TCP ya está ocupado, subir `N`. Si el HTTP nuevo (19600+K / 19700+K / 19800+K) ya está ocupado, subir `K`. No reasignar HTTP de ramas históricas.

No usar **8443** (preview Figma de otro proyecto). El 27017 interno de Mongo **no se incrementa**.

---

## 2. Fórmula de puertos (base = `test_pollo`, N = 0)

| Recurso | Fórmula | N=0 pollo | N=1 saasa | N=2 carne | N=3 usa | N=4 starcool | N=5 tk |
|---------|---------|-----------|-----------|-----------|---------|--------------|--------|
| TCP dispositivo | `9910 + N` | 9910 | 9911 | 9912 | 9913 | 9914 | **9915** |
| Bridge HTTP | `8081 + N` | 8081 | 8082 | 8083 | 8084 | 8085 | 8086 |
| Backend | `9081 + N` | 9081 | 9082 | 9083 | 9084 | 9085 | 9086 |
| Superadmin serial | `8089 + N` | 8089 | 8090 | 8091 | 8092 | 8093 | 8094 |
| Ztrack | `8444 + N` | 8444 | 8445 | 8446 | 8447 | 8448 | 8449 |
| Mongo host | `29017 + N` → 27017 | 29017 | 29018 | 29019 | 29020 | 29021 | 29022 |
| Proyecto Compose `name:` | `test_4g_<slug>` | `test_4g_pollo` | `test_4g_saasa` | `test_4g_carne` | `test_4g_usa` | `test_4g_starcool` | `test_4g_tk` |
| `MONGO_DB` | `test_4g_<TCP>` | `test_4g` | `test_4g_9911` | `test_4g_9912` | `test_4g_9913` | `test_4g_9914` | `test_4g_9915` |
| Volumen Compose | `mongo_data_<TCP>` | `mongo_data` | `mongo_data_9911` | `mongo_data_9912` | `mongo_data_9913` | `mongo_data_9914` | `mongo_data_9915` |
| `CLEAN_PORT` | igual que TCP | 9910 | 9911 | 9912 | 9913 | 9914 | 9915 |

N=11 (`test_usa_9921`, histórico): TCP **9921**, bridge **8092**, backend **9092**, serial **8100**, ztrack **8455**, mongo host **29028**, `name: test_4g_usa_9921`, `MONGO_DB=test_4g_9921`, volumen `mongo_data_9921`.

`port_cleaner` solo debe matar contenedores de **ese** TCP, nunca el 9910 si esta rama es 9912.

---

## 2b. Fórmula HTTP nueva (desde `test-gasificado`, no tocar lo anterior)

Los HTTP `8081+N` / `9081+N` / `8089+N` chocan entre sí (p. ej. bridge N=11 = serial N=3 = 8092). A partir de **esta** rama se usa otra serie. El TCP sigue siendo `9910 + N`. Ztrack y Mongo host siguen `8444 + N` y `29017 + N`.

| Recurso | Fórmula nueva | K=0 gasificado | K=1 (próxima) | K=2 |
|---------|---------------|----------------|---------------|-----|
| Superadmin serial | `19600 + K` | **19600** | 19601 | 19602 |
| Backend | `19700 + K` | **19700** | 19701 | 19702 |
| Bridge HTTP | `19800 + K` | **19800** | 19801 | 19802 |

| Recurso (sin cambio de serie) | Fórmula | Gasificado (N=6, K=0) |
|-------------------------------|---------|------------------------|
| TCP dispositivo | `9910 + N` | **9916** |
| Ztrack | `8444 + N` | 8450 |
| Mongo host | `29017 + N` → 27017 | 29023 |
| `name:` / `MONGO_DB` / volumen / `CLEAN_PORT` | igual que §2 | `test_4g_gasificado` / `test_4g_9916` / `mongo_data_9916` / 9916 |

Reglas:

1. Ramas **ya creadas** (pollo 9910 … tk 9915, usa_9921) **se quedan** con su HTTP histórico de la sección 2.
2. `test-gasificado` es **K=0**. Cada rama **nueva** después de esta toma el siguiente `K` libre.
3. No volver a usar 8081–8100 / 9081–9092 para HTTP de ramas nuevas.

---

## 3. Protocolo de trabajo (humano + agente)

1. **Carpeta nueva** (clone o copia). No reutilizar la carpeta donde ya corre otro `N`.
2. `git checkout -b <rama>` desde el origen acordado.
3. Aplicar `N` al TCP / Ztrack / Mongo host, y `K` al serial / backend / bridge (sección 2b). Un reemplazo ciego de `9910` puede romper dumps JSON y tests de tramas: sustituir **archivo a archivo**, solo defaults y bind de red.
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
- Offset N (TCP): …
- Offset K (HTTP nuevo): …
- Rama origen: …
- Carpeta de trabajo (absoluta): …

Haz esto, en orden:
1. Confirma que estás en esa carpeta y rama. Si el TCP 9910+N ya está ocupado, PARA y propone N+1. Si 19600+K / 19700+K / 19800+K ya están ocupados, PARA y propone K+1.
2. TCP / Ztrack / Mongo host: fórmula N (sección 2). Serial / backend / bridge: fórmula K (sección 2b: 19600+K, 19700+K, 19800+K). No remapees HTTP de ramas históricas. Mongo interno se queda en 27017. No uses 8443. No reescribas dumps JSON ni hex 82A7.
3. docker-compose.yml debe tener name: test_4g_<slug>, MONGO_DB test_4g_<TCP>, volumen mongo_data_<TCP>, CLEAN_PORT = TCP.
4. Actualiza README.md, contexto.md y la tabla de entornos en multiples_puertos.md.
5. docker compose up -d --build en ESTA carpeta. No hagas down del otro entorno.
6. Verifica health.db, contenedores con prefijo test_4g_<slug>-, y que el TCP nuevo escucha.
7. Al terminar, entrega la tabla N de puertos y las URLs (serial, ztrack, backend).

Regla: una rama = una carpeta = un name Compose = un TCP = una Mongo. Git checkout no aísla Docker.
```

---

## 7. Rama `test-carne` (TCP 9912) — qué hacer al cambiar

Esta rama **`test-carne`** ya tiene el mapa N=2 aplicado (TCP 9912). `test-saasa` en Git sigue en 9911.

Cuando pases a carne, en **otra carpeta** (recomendado) o, si no queda otra, avisar al agente que saasa debe seguir arriba en su carpeta:

```bash
# 1) carpeta nueva (no la de saasa)
mkdir -p /ruta/carne && cd /ruta/carne
git clone <url-TEST_4G> TEST_4G
cd TEST_4G

# 2) rama desde saasa (tiene ztrack + aislamiento)
git fetch
git checkout test-saasa
git checkout -b test-carne

# 3) pegar el prompt de la sección 8 al agente
# 4) el agente cambia puertos y hace: docker compose up -d --build
```

Si solo haces `git checkout test-carne` **en la misma carpeta de saasa**, Docker no se aísla solo. El compose de carne tiene otro `name:` (`test_4g_carne`), así que puede convivir con `test_4g_saasa` **si no bajas saasa**. Aun así, los archivos de esta carpeta dejarán de ser 9911: usa carpeta propia.

Valores que el agente debe dejar escritos (no inventar otros):

| Recurso | Valor carne |
|---------|-------------|
| Rama | `test-carne` |
| `name:` | `test_4g_carne` |
| TCP | **9912** |
| Bridge HTTP | 8083 |
| Backend | 9083 |
| Serial | http://localhost:8091 |
| Ztrack | http://localhost:8446 |
| Mongo host | 29019 → 27017 |
| `MONGO_DB` | `test_4g_9912` |
| Volumen | `mongo_data_9912` |
| `CLEAN_PORT` | 9912 |
| Contenedores | `test_4g_carne-*` |
| `health.db` | `test_4g_9912` |

El equipo de carne apunta a **9912**. Pollo sigue en 9910. Saasa sigue en 9911.

---

## 8. Prompt listo: `test-carne`

Copiar este bloque **tal cual** cuando ya estés en la carpeta de carne y la rama `test-carne` exista (o pedirle al agente que la cree desde `test-saasa`).

```text
Sigue el protocolo de ram_tcp.md (TEST_4G). No improvises puertos.

Entrada:
- Rama Git: test-carne
- Slug Compose: carne
- Offset N: 2
- Rama origen: test-saasa
- TCP: 9912

Haz esto, en orden:
1. Confirma la carpeta y la rama. Si no existe test-carne, créala desde test-saasa (git checkout test-saasa && git checkout -b test-carne). Si 9912, 8083, 9083, 8091, 8446 o 29019 ya están ocupados, PARA y avisa. No uses 8443.
2. Estamos en N=2. Cambia TODOS los binds/defaults de saasa (9911 / 8082 / 9082 / 8090 / 8445 / 29018 / test_4g_9911 / mongo_data_9911 / test_4g_saasa / CLEAN_PORT 9911) a los de carne:
   - name: test_4g_carne
   - TCP 9912, bridge 8083, backend 9083, serial 8091, ztrack 8446, mongo host 29019:27017
   - MONGO_DB=test_4g_9912
   - volumen mongo_data_9912
   - CLEAN_PORT=9912
   - VITE_SERIAL_URL y links de UI a :8091 y :8446
   Mongo interno se queda en 27017. No reescribas dumps JSON ni hex 82A7.
3. Archivos de ram_tcp.md sección 4. docker-compose.yml debe quedar name: test_4g_carne.
4. Actualiza README.md, contexto.md, multiples_puertos.md y la tabla de ram_tcp.md (carne = N=2, hecho).
5. docker compose up -d --build SOLO en esta carpeta. No hagas down de test_4g_saasa ni de test_4g_pollo.
6. Verifica: curl http://localhost:9083/api/health → db test_4g_9912; contenedores test_4g_carne-*; ss -lnt | grep 9912; serial :8091 y ztrack :8446 responden.
7. Al terminar entrega la tabla de puertos carne y deja test-saasa (9911) intacto.

Regla: una rama = una carpeta = un name Compose = un TCP = una Mongo. Git checkout no aísla Docker.
```

---

## 9. Rama `test-tk` (TCP 9915) — hecho (N=5)

9913 (usa) y 9914 (starcool) ya estaban tomados. Siguiente libre: **9915**.

Origen: `test-carne`. `name: test_4g_tk`.

| Recurso | Valor tk |
|---------|----------|
| Rama | `test-tk` |
| `name:` | `test_4g_tk` |
| TCP | **9915** |
| Bridge HTTP | 8086 |
| Backend | http://localhost:9086 |
| Serial | http://localhost:8094 |
| Ztrack | http://localhost:8449 |
| Mongo host | 29022 → 27017 |
| `MONGO_DB` | `test_4g_9915` |
| Volumen | `mongo_data_9915` |
| `CLEAN_PORT` | 9915 |
| Contenedores | `test_4g_tk-*` |

---

## 10. Prompt listo: `test-tk`

```text
Sigue el protocolo de ram_tcp.md (TEST_4G). No improvises puertos.

Entrada:
- Rama Git: test-tk
- Slug Compose: tk
- Offset N: 5
- Rama origen: test-carne
- TCP: 9915

Haz esto, en orden:
1. Confirma la carpeta y la rama. Si no existe test-tk, créala desde test-carne. Si 9915, 8086, 9086, 8094, 8449 o 29022 ya están ocupados, PARA y avisa. No uses 8443.
2. Estamos en N=5. Deja TODOS los binds/defaults en el mapa tk:
   - name: test_4g_tk
   - TCP 9915, bridge 8086, backend 9086, serial 8094, ztrack 8449, mongo host 29022:27017
   - MONGO_DB=test_4g_9915
   - volumen mongo_data_9915
   - CLEAN_PORT=9915
   - VITE_SERIAL_URL y links de UI a :8094 y :8449
   Mongo interno se queda en 27017. No reescribas dumps JSON ni hex 82A7.
3. Archivos de ram_tcp.md sección 4. docker-compose.yml debe quedar name: test_4g_tk.
4. Actualiza README.md, contexto.md, multiples_puertos.md y la tabla de ram_tcp.md (tk = N=5, hecho).
5. docker compose up -d --build SOLO en esta carpeta. No hagas down de test_4g_carne, test_4g_starcool, test_4g_saasa ni test_4g_pollo.
6. Verifica: curl http://localhost:9086/api/health → db test_4g_9915; contenedores test_4g_tk-*; ss -lnt | grep 9915; serial :8094 y ztrack :8449 responden.
7. Al terminar entrega la tabla de puertos tk y deja las otras ramas intactas.

Regla: una rama = una carpeta = un name Compose = un TCP = una Mongo. Git checkout no aísla Docker.
```

---

## 11. Rama `test_usa_9921` (TCP 9921) — hecho (N=11)

Fórmula `9910 + 11`. Slug `usa_9921`. No usa 9913 (reservado a `test-usa`).

| Recurso | Valor usa_9921 |
|---------|----------------|
| Rama | `test_usa_9921` |
| `name:` | `test_4g_usa_9921` |
| TCP | **9921** |
| Bridge HTTP | 8092 |
| Backend | http://localhost:9092 |
| Serial | http://localhost:8100 |
| Ztrack | http://localhost:8455 |
| Mongo host | 29028 → 27017 |
| `MONGO_DB` | `test_4g_9921` |
| Volumen | `mongo_data_9921` |
| `CLEAN_PORT` | 9921 |
| Contenedores | `test_4g_usa_9921-*` |

---

## 12. Rama `test-gasificado` (TCP 9916) — hecho (N=6, K=0)

Siguiente TCP libre secuencial tras tk 9915: **9916**. Primera rama de la serie HTTP nueva (sección 2b). Slug `gasificado`.

| Recurso | Valor gasificado |
|---------|------------------|
| Rama | `test-gasificado` |
| `name:` | `test_4g_gasificado` |
| TCP | **9916** |
| Bridge HTTP | **19800** |
| Backend | http://localhost:19700 |
| Serial | http://localhost:19600 |
| Ztrack | http://localhost:8450 |
| Mongo host | 29023 → 27017 |
| `MONGO_DB` | `test_4g_9916` |
| Volumen | `mongo_data_9916` |
| `CLEAN_PORT` | 9916 |
| Contenedores | `test_4g_gasificado-*` |

---

## 13. Prompt listo: `test-gasificado`

```text
Sigue el protocolo de ram_tcp.md (TEST_4G). No improvises puertos.

Entrada:
- Rama Git: test-gasificado
- Slug Compose: gasificado
- Offset N: 6
- Offset K: 0
- Rama origen: test_usa_9921
- TCP: 9916

Haz esto, en orden:
1. Confirma la carpeta y la rama. Si no existe test-gasificado, créala desde el origen. Si 9916, 19800, 19700, 19600, 8450 o 29023 ya están ocupados, PARA y avisa. No uses 8443.
2. Estamos en N=6, K=0. Deja TODOS los binds/defaults en el mapa gasificado:
   - name: test_4g_gasificado
   - TCP 9916, bridge 19800, backend 19700, serial 19600, ztrack 8450, mongo host 29023:27017
   - MONGO_DB=test_4g_9916
   - volumen mongo_data_9916
   - CLEAN_PORT=9916
   - VITE_SERIAL_URL y links de UI a :19600 y :8450
   Mongo interno se queda en 27017. No reescribas dumps JSON ni hex 82A7. No remapees HTTP de ramas históricas.
3. Archivos de ram_tcp.md sección 4. docker-compose.yml debe quedar name: test_4g_gasificado.
4. Actualiza README.md, contexto.md, multiples_puertos.md y la tabla de ram_tcp.md (gasificado = N=6 K=0, hecho).
5. docker compose up -d --build SOLO en esta carpeta. No hagas down de los otros stacks.
6. Verifica: curl http://localhost:19700/api/health → db test_4g_9916; contenedores test_4g_gasificado-*; ss -lnt | grep 9916; serial :19600 y ztrack :8450 responden.
7. Al terminar entrega la tabla de puertos gasificado y deja las otras ramas intactas.

Regla: una rama = una carpeta = un name Compose = un TCP = una Mongo. Git checkout no aísla Docker.
```

