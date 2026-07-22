# TEST_4G — Monitor TCP 9910

Puente TCP en **9910**, backend MongoDB, frontend tipo monitor serial (string/hex).

## Arquitectura

```
Dispositivo ──TCP:9910──► tcp_bridge ──HTTP──► backend ──► MongoDB
                              │                  │
                         HTTP:8081            WS + REST
                         (send/list)             │
                                                 ▼
                                           frontend:8089
```

## Cumple (contexto.md)

1. `port_cleaner` libera el puerto **9910** al arrancar Compose.
2. `tcp_server_loop`: `AF_INET`/`SOCK_STREAM`, `SO_REUSEADDR`, `bind(0.0.0.0, 9910)`, `listen(10)`.
3. Cada `accept()` → hilo `handle_client`.
4. Al arrancar: `POST /api/internal/disconnect_all`.
5. Flujo: `register_pending` → `recv(4096)` → buffer → líneas (`\r\n`/`\n`/`\r`) → `parse_chunks` → backend.
6. Sweep de IPs huérfanas (socket muerto / idle) sin tocar sesiones vivas.
7. Envío a dispositivo por `addr` o `ip` en **string** o **hex**.

## Arranque (Docker)

```bash
docker compose up --build -d
```

| Servicio   | URL / puerto      |
|------------|-------------------|
| Frontend   | http://localhost:8089 |
| Backend    | http://localhost:9070 |
| Bridge HTTP| http://localhost:8081 |
| TCP equipos| `host:9910`       |
| MongoDB    | localhost:29017   |

## Uso del monitor

1. Abre http://localhost:8089
2. Los equipos que abran TCP a `:9910` aparecen en la lista (solo conexiones reales).
3. Selecciona uno, mira RX en string/hex, envía comandos.
4. **Limpiar huérfanas** fuerza el sweep si un equipo cambió de IP.

## API rápida

```bash
# Dispositivos vivos
curl http://localhost:8081/devices

# Enviar string
curl -X POST http://localhost:9070/api/send \
  -H 'Content-Type: application/json' \
  -d '{"ip":"1.2.3.4","message":"AT\r\n","encoding":"string"}'

# Enviar hex
curl -X POST http://localhost:9070/api/send \
  -H 'Content-Type: application/json' \
  -d '{"addr":"1.2.3.4:54321","message":"48656C6C6F","encoding":"hex"}'
```

## Legacy APIs (test_9910)

Para reenviar JSON a TermoKing/Datos como el script original:

```bash
FORWARD_LEGACY=1 docker compose up -d tcp_bridge
```
# TEST_4G
