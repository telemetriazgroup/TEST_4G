# Lógica TCP — TEST_4G (puerto 9910)

Documentación del servicio `tcp_bridge` (`tcp_bridge/bridge.py`), que escucha conexiones TCP, parsea tramas (string/hex/JSON), limpia IPs huérfanas y permite enviar comandos de vuelta al dispositivo. El backend guarda en MongoDB y el frontend actúa como monitor serial web.

---

## Puertos involucrados

| Puerto | Servicio | Función |
|--------|----------|---------|
| **9910** | `tcp_bridge` (TCP) | Conexión entrante del dispositivo |
| **8081** | `tcp_bridge` (HTTP interno) | API para enviar comandos y consultar dispositivos conectados |
| **9081** | `backend` (HTTP + WS) | API REST, MongoDB, WebSocket |
| **8089** | `frontend` (HTTP) | Interfaz web tipo monitor serial |
| **29017** | `mongo` (host → 27017 contenedor) | Persistencia |

El dispositivo **se conecta al servidor** por TCP 9910. No es el backend quien abre la conexión hacia el equipo.

```
Dispositivo ──TCP:9910──► tcp_bridge ──HTTP──► backend ──► MongoDB
                              │
                              └── POST /api/internal/* (telemetría, conexión)
```

---

## Estructura de conexión

1. Al iniciar el contenedor `tcp_bridge`, el servicio `port_cleaner` (Docker Compose) detiene contenedores previos que ocupen el puerto **9910**.
2. `tcp_bridge` arranca un hilo con `tcp_server_loop()`:
   - Crea socket `AF_INET` / `SOCK_STREAM`
   - `bind(0.0.0.0, 9910)` con `SO_REUSEADDR`
   - `listen(10)` — hasta 10 conexiones en cola
3. Por cada `accept()`, se lanza un **hilo independiente** `handle_client(conn, addr)`.
4. Al arrancar también se notifica al backend `POST /api/internal/disconnect_all` para limpiar estados `is_connected` obsoletos en base de datos.

---

## Recepción de la trama

### Flujo por conexión

```
accept() → register_pending(addr, conn) → bucle recv(4096) → buffer → líneas → parse_chunks() → backend
```

1. **Conexión nueva:** se registra el socket en `_conn_by_addr` (sesión pendiente, aún sin IMEI).
2. **Lectura:** cada `recv` trae hasta 4096 bytes, decodificados UTF-8 (`errors="replace"`). También se calcula la vista hexadecimal del chunk.
3. **Buffer:** los bytes se acumulan hasta formar líneas completas.
4. **Separadores:** se corta por `\r\n`, `\n` o `\r` (en ese orden de búsqueda).
5. **Sin salto de línea:** si el buffer contiene una trama de sensor completa (regex), se procesa igual y se vacía el buffer.
6. **Procesamiento:** cada línea pasa por `parse_chunks()` (JSON / hex / string) y luego se envía al backend.

---

## IPs huérfanas

Los equipos se conectan/desconectan y pueden cambiar de IP. El bridge:

- Quita del registro al cerrar el socket (`unregister`).
- Ejecuta un **sweep periódico** (`orphan_loop`): sockets muertos (`MSG_PEEK`) o idle > `IDLE_TIMEOUT_S`.
- No interrumpe conexiones vivas.
- El backend marca como `orphan` / `is_connected=false` las entradas de DB que ya no están en el bridge.
- Endpoint manual: `POST /api/sweep` (frontend: botón “Limpiar huérfanas”).

Así se evita mostrar “30 conectados” cuando en realidad hay 2.

---

## Envío al dispositivo

- Por `addr` (`ip:port`) o por `ip` (sesión más reciente de esa IP).
- Codificación: `string` o `hex`.
- Bridge: `POST http://tcp_bridge:8081/send`
- Backend (frontend): `POST /api/send`

---

## Monitor web

Interfaz en `:8089`: lista de dispositivos vivos, terminal RX/TX en string y/o hex, envío de comandos. Persistencia de mensajes en MongoDB.



## Captura de tramas HEX

Los dispositivos envían tramas en **hexadecimal**. El sistema:

1. Guarda cada trama en MongoDB como `hex` (canónico) + `decimal` (bytes convertidos).
2. Captura la **cabecera TCP** de aplicación: `src_ip`, `src_port`, `dst_port`, `payload_len`, evento connect/data/disconnect.
3. Interfaz en dos módulos:
   - **Serial en vivo**: flujo en tiempo real (WebSocket) con HEX y Decimal.
   - **Histórico**: tramas persistidas consultables desde MongoDB.
4. Botón **Actualizar serial** para refrescar lo recibido sin perder el histórico.