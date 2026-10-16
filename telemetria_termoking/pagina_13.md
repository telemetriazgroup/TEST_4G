# Página 13 — Telegramas del controlador de frío

Secciones **4.3** y **4.3.1**. Aquí empieza lo que el ciclo de la rama `test-tk` ya transmite.

El manual avisa que la lista puede crecer por el final. Vale la regla de la página 9: se interpreta solo el largo recibido.

## 4.3.1 Pedido de lectura

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `A7` |
| 2 | Sub Command | `10` |
| 3 | Request | Qué lectura se pide. La tabla 4.3.1.1 |

`10` significa “esto es un pedido”. El byte 3 elige el contenido. En la trama, con el envoltorio:

```
1B 02 | 04 | 00 | 00 | 82 A7 10 | request | CRC | 1B 04
```

## 4.3.1.1 Qué se puede pedir

| Request | Lectura | Dónde se describe |
|---:|---|---|
| 0 | Sensores | 4.3.2, páginas 14 y 15 |
| 1 | Control | El manual remite a una sección aún no numerada en esta página |
| 2 | Entradas y salidas | 4.3.4 |
| 3 | Texto de rótulos | 4.3.5 |
| 4 | Datos de viaje | 4.3.6 |
| 5 | Configuración | 4.3.7 |
| 6 | Alarmas | 4.3.8 |
| 7 | Información A | 4.3.9 |
| 8 | Información B | 4.3.10 |
| 9 | Información C | 4.3.11 |
| `20` | Información extendida definida aparte | |
| 255 | Todas las anteriores | |

El 255 pide la lista entera en un solo telegrama. Las respuestas son largas y solo puede haber un pedido pendiente, así que el ciclo no lo usa: pide de a una.

## Los dos hex del minuto

| Request | Trama que se envía | Qué vuelve | Dónde se publica |
|---:|---|---|---|
| 0 sensores | `1B0204000082A71000CAE91B04` | `82 A7 00` y el mapa de las páginas 14 y 15 | `d02` |
| 1 control | `1B0204000082A71001DAC81B04` | `82 A7 01` y el bloque de control | `d03` |

El CRC de cada una ya cerró en la página 7. El subcomando de la respuesta deja el `10` y pasa a ser el número de la lectura: `00` sensores, `01` control.

Las lecturas 2 a 9 y la `20` no se piden en este ciclo. Alarmas (`6`) sería el candidato a `d08` cuando se agregue; hoy `d08` viaja vacío.

## Qué hace la telemetría con esta página

Cada minuto, en cada conexión: request 0, cinco segundos, request 1. El JSON lleva el hex de cada respuesta completa, desde `1B 02` hasta `1B 04`, sin el IMEI ni los `FF FF FF FF` del módem.
