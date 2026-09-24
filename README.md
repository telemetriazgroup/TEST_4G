# TEST_4G — Monitor TCP 9916

Puente TCP en **9916**, backend MongoDB, frontend tipo monitor serial (string/hex).

## Arquitectura

```
Dispositivo ──TCP:9916──► tcp_bridge ──HTTP──► backend ──► MongoDB
                              │                  │
                         HTTP:19800           WS + REST
                         (send/list)             │
                                                 ▼
                                    frontend:19600 (superadmin)
                                    ztrack:8450    (admin / monitor)
```

## Cumple (contexto.md)

1. `port_cleaner` libera el puerto **9916** al arrancar Compose.
2. `tcp_server_loop`: `AF_INET`/`SOCK_STREAM`, `SO_REUSEADDR`, `bind(0.0.0.0, 9916)`, `listen(10)`.
3. Cada `accept()` → hilo `handle_client`.
4. Al arrancar: `POST /api/internal/disconnect_all`.
5. Flujo: `register_pending` → `recv(4096)` → buffer → líneas (`\r\n`/`\n`/`\r`) → `parse_chunks` → backend.
6. Sweep de IPs huérfanas (socket muerto / idle) sin tocar sesiones vivas.
7. Envío a dispositivo por `addr` o `ip` en **string** o **hex**.

## Arranque (Docker)

Esta rama es **`test-gasificado`** (TCP **9916**, N=6, HTTP K=0: serial 19600 / backend 19700 / bridge 19800). No comparte puertos ni Mongo con `test_pollo` (9910), `test-saasa` (9911), `test-carne` (9912), `test-usa` (9913), `test-starcool` (9914), `test-tk` (9915) ni `test_usa_9921` (9921). Causas: [multiples_puertos.md](./multiples_puertos.md). Protocolo: [ram_tcp.md](./ram_tcp.md).

```bash
docker compose up --build -d
```

| Servicio   | URL / puerto      |
|------------|-------------------|
| Ztrack     | http://localhost:8450 |
| Superadmin | http://localhost:19600 |
| Backend    | http://localhost:19700 |
| Bridge HTTP| http://localhost:19800 |
| TCP equipos| `host:9916`       |
| MongoDB    | localhost:29023   |

### Persistencia (MongoDB `test_4g_9916`)

Base y volumen propios de este stack (`mongo_data_9916`). No reutiliza `test_4g`, `test_4g_9911`, `test_4g_9912`, `test_4g_9915` ni `test_4g_9921`.

| Colección | Contenido |
|-----------|-----------|
| `sessions` | Sesión por **IP** (activa/histórica, rx_count, tx_count) |
| `messages` | Cada trama RX/TX (hex, decimal, session_id, ip, addr) |
| `devices` | Estado vivo por `ip:port` |

```bash
# Sesiones por IP
curl 'http://localhost:19700/api/sessions?ip=1.2.3.4'
# Mensajes de una IP
curl 'http://localhost:19700/api/messages?ip=1.2.3.4&limit=100'
# Histórico
curl 'http://localhost:19700/api/history?ip=1.2.3.4'
```

## Uso del monitor

1. Abre http://localhost:19600
2. Los equipos que abran TCP a `:9916` aparecen en la lista (solo conexiones reales).
3. Selecciona uno, mira RX en string/hex, envía comandos.
4. **Limpiar huérfanas** fuerza el sweep si un equipo cambió de IP.

## API rápida

```bash
# Dispositivos vivos
curl http://localhost:19800/devices

# Enviar string
curl -X POST http://localhost:19700/api/send \
  -H 'Content-Type: application/json' \
  -d '{"ip":"1.2.3.4","message":"AT\r\n","encoding":"string"}'

# Enviar hex
curl -X POST http://localhost:19700/api/send \
  -H 'Content-Type: application/json' \
  -d '{"addr":"1.2.3.4:54321","message":"48656C6C6F","encoding":"hex"}'
```

## Legacy APIs (test_9910)

Para reenviar JSON a TermoKing/Datos como el script original:

```bash
FORWARD_LEGACY=1 docker compose up -d tcp_bridge
```
# TEST_4G
