# Página 21 — Alarm Readout

Sección **4.3.8**. Request 6. Es el listado de alarmas del controlador. La respuesta se reconoce por `82 A7 06`.

## Pedido y respuesta

| Byte de dato | Pedido | Respuesta |
|---:|---|---|
| 0 | Format `82` | Format `82` |
| 1 | Command `A7` | Reply `A7` |
| 2 | Sub Command `10` | Sub Reply `06` |
| 3 | Request `06` | Hasta diez alarmas |

En el JSON de cada minuto el campo `d08` está reservado para este bloque y hoy viaja vacío. El ciclo no pide el request 6. El “alarma presente” de los bytes 0–1 del control (`d03`) solo dice si hay alguna; el número sale de aquí.

## Mapa

| Bytes | Qué es |
|---:|---|
| 0–1 | Alarmas presentes. 0 = no hay ninguna |
| 2–3 | Alarma 1 |
| 4–5 | Alarma 2 |
| 6–7 | Alarma 3 |
| 8–9 | Alarma 4 |
| 10–11 | Alarma 5 |
| 12–13 | Alarma 6 |
| 14–15 | Alarma 7 |
| 16–17 | Alarma 8 |
| 18–19 | Alarma 9 |
| 20–21 | Alarma 10 |

Cada alarma es un entero de 16 bits, byte bajo primero. Los bits, del 15 al 0:

| Bits | Uso |
|---|---|
| 15 | Reconocida |
| 14–12 | Grupo, de 0 a 7 |
| 0–11 | Número de alarma |

El grupo no está definido y no se usa en las versiones publicadas. Se ignora. El número que se muestra es el de los bits 0 a 11. El bit 15 solo dice si alguien ya la reconoció en el controlador.

Ejemplo: bytes `05 80` son el valor `0x8005`. Bit 15 en 1, número 5: alarma 5 ya reconocida. Bytes `05 00` son la misma alarma sin reconocer.

Si los bytes 0–1 valen 0, las diez ranuras no se publican como alarmas activas aunque conserven un número viejo. Si hay alarma presente, se recorren las ranuras cuyo número (bits 0–11) no sea 0.

## Qué hace la telemetría con esta página

Cuando el `d03` marque alarma presente, un pedido aparte `82 A7 10 06` llena `d08` con la trama completa. En la pantalla, cada ranura se parte en número y reconocida. El grupo no se muestra.
