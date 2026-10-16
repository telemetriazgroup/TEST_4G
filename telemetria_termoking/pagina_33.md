# Página 33 — Do CT/MTS command

Sección **4.3.18**. Interfaz vieja para el tratamiento de frío (CT) y el ajuste multi-temperatura (MTS). El manual la deja solo para depuración. La reemplazan el `88` de la página 34 y el `89` de la página 35.

## Pedido

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `A7` |
| 2 | Sub Command | `87` |
| 3 en adelante | Data | Índice y valor |

| Bytes | Qué es | Cómo se lee |
|---:|---|---|
| 0–1 | Índice | Entero de 16 bits, byte bajo primero |
| 2–5 | Valor numérico | 32 bits, byte más bajo primero. `12345678` viaja como `78 56 34 12` |
| 2 en adelante | Fecha u otro texto | BCD `YYMMDDHHmmss`, o una cadena, según el índice |

### Índices

| Índice | Qué escribe |
|---|---|
| `20`–`29` | Setpoint MTS 0 a 9, Fp100 |
| `30`–`39` | Periodo MTS 0 a 9, en segundos |
| `40` | Setpoint del tratamiento de frío, Fp100 |
| `41` | Periodo del tratamiento de frío, en segundos |
| `42` | Temperatura máxima de las sondas USDA, Fp100 |
| `43` | Setpoint final del tratamiento de frío, Fp100 |

Fp100 se divide entre 100. Estos periodos están en segundos. En la interfaz nueva de las páginas 34 y 35 el periodo pasa a horas y la temperatura a Fp10. No se lee un bloque con la escala del otro.

## Respuesta

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Reply | `A7` |
| 2 | Sub Reply | `86` |
| 3 en adelante | Data | El texto `state: xxx`, donde `xxx` es el estado actual |

El subcomando de vuelta es `86`, no `87`. El estado llega como texto, no como el mapa de bytes de las páginas 34 y 36.

## Qué hace la telemetría con esta página

No se envía. Un `87` en un equipo actual no es el camino del tratamiento de frío. Para leer o cambiar ese tratamiento se usa el `88` o el `89`, y tampoco van en el minuto.
