# Varios puertos = varios entornos (test_pollo vs test-saasa)

Este repo se copia en **carpetas distintas** y se trabaja en **ramas distintas**. Cada carpeta debe levantar **su propio** TCP, HTTP, Mongo y contenedores. No se comparte nada en el host.

Hoy:

| Rama | Carpeta (ejemplo) | Idea |
|------|-------------------|------|
| `test_pollo` | `.../TEST_4G` (pollo / pollitos) | Interfaz y datos de pollo BB |
| `test-saasa` | otra `.../TEST_4G` (saasa) | Interfaz y datos de esa línea |
| `test-carne` | otra carpeta (carne) | TCP **9912** — ver [ram_tcp.md](./ram_tcp.md) sección 7–8 |

Docker **no entiende de ramas Git**. Solo ve: nombre de proyecto Compose, puertos del host y volúmenes. Si dos carpetas se llaman `TEST_4G` y el compose no declara `name:`, las dos se llaman proyecto `test_4g` y se pisan.

---

## Mapa fijo de entornos

### `test_pollo` — TCP 9910 (base)

| Recurso | Valor |
|---------|--------|
| Proyecto Compose | `test_4g_pollo` |
| TCP dispositivo | **9910** |
| Bridge HTTP | 8081 |
| Backend | 9081 |
| Superadmin serial | 8089 |
| Ztrack | 8444 |
| Mongo host | 29017 → 27017 |
| Base Mongo | `test_4g` |
| Volumen | `mongo_data` (Compose lo nombra `test_4g_pollo_mongo_data`) |

### `test-saasa` — TCP 9911

| Recurso | Valor |
|---------|--------|
| Proyecto Compose | `test_4g_saasa` |
| TCP dispositivo | **9911** |
| Bridge HTTP | 8082 |
| Backend | 9082 |
| Superadmin serial | 8090 |
| Ztrack | 8445 |
| Mongo host | 29018 → 27017 |
| Base Mongo | `test_4g_9911` |
| Volumen | `mongo_data_9911` (Compose lo nombra `test_4g_saasa_mongo_data_9911`) |

### `test-carne` — TCP 9912 (esta rama)

| Recurso | Valor |
|---------|--------|
| Proyecto Compose | `test_4g_carne` |
| TCP dispositivo | **9912** |
| Bridge HTTP | 8083 |
| Backend | 9083 |
| Superadmin serial | 8091 |
| Ztrack | 8446 |
| Mongo host | 29019 → 27017 |
| Base Mongo | `test_4g_9912` |
| Volumen | `mongo_data_9912` (Compose lo nombra `test_4g_carne_mongo_data_9912`) |

Pollo → **9910**. Saasa → **9911**. Carne → **9912**. Las URLs no se mezclan.

En `test-saasa` el `docker-compose.yml` ya lleva `name: test_4g_saasa`. En `test_pollo` hay que poner `name: test_4g_pollo` (si esa rama aún no lo tiene, los contenedores se llaman `test_4g-*` y chocan con cualquier otra carpeta también llamada `TEST_4G`).

---

## Por qué daba error (causas reales)

### 1. Mismo puerto TCP en el host

`bind(0.0.0.0, 9910)` solo cabe **una** vez. Si `test_pollo` ya escucha 9910, `test-saasa` con 9910 falla:

```text
failed to bind host port for 0.0.0.0:9910: address already in use
```

Lo mismo con 8089, 9081, 8444, 29017. Por eso saasa **incrementa todos en 1**.

### 2. Mismo nombre de proyecto Compose

Compose nombra el proyecto con el **nombre de la carpeta**, no con la rama.

Dos rutas:

```text
/home/ztrack/mongo/Proyectos/TEST_4G          ← test_pollo
/home/ztrack/mongo/Proyectos/saasa/TEST_4G    ← test-saasa
```

Si ambas carpetas se llaman `TEST_4G` y el YAML no tiene `name:`, las dos son proyecto `test_4g`. Entonces:

- mismos contenedores: `test_4g-backend-1`, `test_4g-tcp_bridge-1`, …
- mismas imágenes: `test_4g-backend:latest`
- `docker compose up` en una carpeta **recrea** lo que levantó la otra

No es “Git se equivocó”. Es Docker reutilizando el mismo proyecto.

### 3. `port_cleaner` tumba al vecino

Al arrancar, un script recorre `docker ps` y hace `docker stop` a **cualquier** contenedor que publique `CLEAN_PORT`.

Si las dos ramas usaban `CLEAN_PORT=9910`, levantar saasa **apagaba** el bridge de pollo (y al revés). Cada rama debe limpiar **solo su** TCP: 9910 pollo, 9911 saasa.

### 4. Misma base / mismo volumen Mongo

Aunque cambies de puerto, si `MONGO_DB=test_4g` y el volumen se llama `mongo_data` **dentro del mismo proyecto Compose**, sigues leyendo sesiones, `messages` y `seguimiento` del otro producto.

Eso es lo que se veía en **serial en vivo**: últimas 100 tramas de la base vieja, dispositivos con `is_connected` de otra época, frescura de hace horas.

Volumen distinto + base distinta + proyecto Compose distinto = datos que no se cruzan.

### 5. `git checkout` en la misma carpeta

Cambiar de `test_pollo` a `test-saasa` **no mueve contenedores**. Solo cambia archivos.

Si en esa carpeta ya corría el stack de 9910 y haces checkout + `docker compose up` **sin** `name:` distinto:

- Compose cree que es el mismo proyecto
- Recrea contenedores con los puertos de la rama nueva
- El volumen `mongo_data` sigue ahí → serial “en vivo” con historia de la rama anterior

Por eso la idea de **una carpeta por interfaz** es correcta, pero **no basta**: hay que separar también proyecto Docker, puertos, volumen y nombre de base.

### 6. El serial “en vivo” pedía histórico

`GET /api/messages?limit=100` devolvía las últimas tramas **de toda la base**, no de la sesión TCP actual. Con la base compartida, el monitor de saasa pintaba tramas de pollo.

En `test-saasa` el vivo solo lista lo que está **conectado ahora en el bridge** y, si hay sesión, las tramas de ese `session_id`. El histórico / archivo sigue siendo otra pestaña.

---

## Solución (regla de oro)

**Una rama = una carpeta = un proyecto Compose = un TCP = una Mongo.**

1. No compartir carpeta de trabajo entre pollo y saasa. Clona o copia `TEST_4G` dos veces.
2. En cada rama, `name:` único en `docker-compose.yml`.
3. Puertos de host sin solaparse (tabla de arriba).
4. `MONGO_DB` y volumen distintos.
5. El equipo apunta al TCP de **esa** carpeta.
6. No hacer `docker compose down` en una carpeta pensando que solo “cambia la rama”: baja **ese** proyecto. El otro, si tiene otro `name:`, debe seguir arriba.

Arranque típico:

```bash
# carpeta pollo, rama test_pollo
cd /ruta/pollo/TEST_4G
git checkout test_pollo
docker compose up -d --build
# TCP 9910 · serial http://localhost:8089 · ztrack http://localhost:8444

# carpeta saasa, rama test-saasa
cd /ruta/saasa/TEST_4G
git checkout test-saasa
docker compose up -d --build
# TCP 9911 · serial http://localhost:8090 · ztrack http://localhost:8445
```

Comprobar que no se pisan:

```bash
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E '9910|9911|8089|8090|8444|8445'
curl -s http://localhost:9081/api/health   # pollo → db test_4g
curl -s http://localhost:9082/api/health   # saasa → db test_4g_9911
```

Si `health.db` es el mismo string en los dos, **siguen cruzados**.

---

## Qué no hace falta

- No hace falta un Mongo “global” compartido.
- No hace falta apagar pollo para trabajar saasa, ni al revés, si los puertos y el `name:` están bien.
- El volumen viejo `mongo_data` de pollo se deja. Saasa no lo monta.

---

## Checklist si vuelve el error

| Síntoma | Causa habitual | Qué mirar |
|---------|----------------|-----------|
| `address already in use` | Otro stack en el mismo puerto | `ss -lnt \| grep 9910` (o 9911, 8089, …) |
| Serial con tramas de ayer / del otro producto | Misma Mongo o mismo volumen | `/api/health` → campo `db` |
| Al `up` de saasa se cae pollo | `port_cleaner` o mismo `name:` | `CLEAN_PORT` y `name:` en el YAML |
| Contenedores `test_4g-backend-1` en las dos carpetas | Compose sin `name:` | Poner `test_4g_pollo` / `test_4g_saasa` |
| Checkout y “aparecen” datos viejos | Misma carpeta + mismo volumen | Usar carpeta por rama, no reutilizar el volumen |

Cuando haga falta **otra rama / otro TCP**, no se copia a ojo: se sigue [ram_tcp.md](./ram_tcp.md) (protocolo + prompt).
