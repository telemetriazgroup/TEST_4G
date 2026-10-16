# Página 25 — Ext Defined Information

Sección **4.3.12**. Request `20`. Existe desde la versión 3.20 del software del CM-4000. Junta en un solo bloque el rótulo, la serie, el reloj del controlador y tres temperaturas. La respuesta se reconoce por `82 A7 20`.

## Pedido y respuesta

| Byte de dato | Pedido | Respuesta |
|---:|---|---|
| 0 | Format `82` | Format `82` |
| 1 | Command `A7` | Reply `A7` |
| 2 | Sub Command `10` | Sub Reply `20` |
| 3 | Request `20` | Dataset |

## Mapa

| Bytes | Qué es | Cómo se lee |
|---:|---|---|
| 0–10 | ID del contenedor | 11 caracteres |
| 11–30 | Serie del controlador | Hasta 20 caracteres. Si es más corta, termina en `00` |
| 31–33 | Fecha del controlador | Tres bytes: año, mes, día |
| 34–36 | Hora del controlador | Tres bytes: hora, minuto, segundo |
| 37–38 | Setpoint | Entero con signo, Fp10, °C |
| 39–40 | Temperatura de retorno | Entero con signo, Fp10, °C |
| 41–42 | Temperatura de suministro | Entero con signo, Fp10, °C |

El ID de los bytes 0–10 tiene el mismo largo que el de la página 18, once caracteres. Sale de otro pedido. El de la página 18 es el request 3; este viaja dentro del request `20`. La serie de aquí es la del controlador, distinta de la serie de la unidad de la página 23 y del IMEI del módem.

## Reloj

No es BCD. Cada campo es un entero.

| Byte | Campo | Rango |
|---|---|---|
| 31 | Año | 0–255. El 0 es el año 2000 |
| 32 | Mes | 1–12 |
| 33 | Día | 1–31 |
| 34 | Hora | 0–23 |
| 35 | Minuto | 0–59 |
| 36 | Segundo | 0–59 |

El byte de año `1A` es 2026, porque 26 + 2000. En la página 19 ese mismo año sería el BCD `26`. Aquí `26` hexadecimal sería el año 2038. Las dos lecturas no se mezclan.

## Temperaturas

El manual fija en esta página la escala que ya usa el mapa de sensores: un entero con signo, byte bajo primero, exponente −1. El valor 123 es 12,3 °C. Por encima de `7FF0` no es una lectura.

Fp10 divide entre 10. El setpoint, el retorno y el suministro de este bloque se leen así, no con la escala Fp100 del sensor readout. Si el mismo equipo también contestó el request 0, las temperaturas de proceso siguen saliendo de ese mapa; estas tres son la copia que el controlador publica en el bloque extendido.

## Qué hace la telemetría con esta página

El request `20` no está en el ciclo de cada minuto. Sirve para leer de una vez el rótulo y el reloj del controlador. El campo `i` del JSON sigue siendo el IMEI. El container ID se guarda aparte.
