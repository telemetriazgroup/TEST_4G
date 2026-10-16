# Página 16 — Control readout

Sección **4.3.3**. Es la respuesta al request 1 de la página 13. Ese hex es el `d03`.

## Pedido y respuesta

| Byte de dato | Pedido | Respuesta |
|---:|---|---|
| 0 | Format `82` | Format `82` |
| 1 | Command `A7` | Reply `A7` |
| 2 | Sub Command `10` | Sub Reply `01` |
| 3 | Request `01` | Desde aquí, el dataset |

La trama que ya sale por TX es `1B0204000082A71001DAC81B04`. La respuesta se reconoce por `82 A7 01`.

Los números de byte del mapa son el offset dentro del Data, el primer par justo después de `82 A7 01`. La escala es la de la página 14: Fp1 no se divide, Fp10 se divide entre 10, Fp100 entre 100. El byte bajo va primero en los campos de dos bytes.

## Mapa

| Bytes | Qué es | Cómo se lee |
|---:|---|---|
| 0–1 | Alarma presente | 0 = no hay alarma |
| 2–3 | Setpoint de temperatura | Fp100 °C |
| 4–5 | Carga de capacidad | Fp1 % |
| 6 | Estado de potencia | Bit 0: hay alimentación de CA. Bit 1: la unidad está activa |
| 7 | Modo de control | Nivel optimizado |
| 8 | Control de humedad | 0 apagado, 1 deshumidificar |
| 9 | Setpoint de humedad | Fp1 % |
| 10 | Modo de aire fresco | 0 apagado, 1 por unidades, 2 por demanda |
| 11–12 | Caudal de aire fresco | Fp1 CMH |
| 13–14 | Retardo del aire fresco | Fp10 horas |
| 15–16 | Setpoint de O₂ | Fp10 % |
| 17–18 | Setpoint de CO₂ | Fp10 % |
| 19–20 | Temperatura de fin de deshielo | Fp100 °C |
| 21 | Intervalo de deshielo | Fp1 horas |
| 22 | Condensador enfriado por agua | 0 apagado, 1 encendido |
| 23 | Viaje USDA | 0 apagado, 1 encendido |
| 24 | Apertura de la válvula de expansión del evaporador | Fp1 %. `FF` = no se usa |
| 25 | Apertura de la válvula de modulación de succión | Fp1 % |
| 26 | Apertura de la válvula de gas caliente | Fp1 % |
| 27 | Apertura de la válvula economizadora | Fp1 % |

El byte 6 es una máscara, no un número. Solo están nombrados el bit 0 y el bit 1; los demás vienen ocupados y esta página no les pone nombre. Un setpoint de dos bytes `98 08` es el entero 2200 y, en Fp100, 22,00 °C.

`FF` en la válvula de expansión es “no usada”, un solo byte. No se confunde con el código de sensor `FE 7F` del mapa de temperaturas.

## Qué hace la telemetría con esta página

El ciclo ya pide este bloque y lo publica crudo en `d03`. Cuando se traduzca, el setpoint del gráfico sale de los bytes 2–3, la humedad de los bytes 8 y 9, y “hay alarma” de los bytes 0–1. El viaje USDA en 1 indica que las cuatro cargas de la página 14 están en un viaje de sondas, no que esas temperaturas hayan cambiado de escala.
