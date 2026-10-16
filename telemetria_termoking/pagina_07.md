# Página 7 — CRC y trama de ejemplo

Secciones **3.2**, **3.2.1** y **3.2.2**.

## 3.2 CRC-CCITT

El chequeo es CRC-CCITT de 16 bits, polinomio `X^16 + X^12 + X^5 + 1`, coeficientes `0x11021`, valor inicial **0**.

Reglas que cambian cómo se implementa:

- Se calcula sobre un flujo de bytes, no sobre la trama ya enmarcada.
- Si al flujo se le agregan los dos bytes del propio CRC y se vuelve a calcular, el resultado nuevo es **0**. Sirve como prueba rápida.
- Puede calcularse byte a byte al recibir, o sobre el buffer completo. El resultado es el mismo.
- El rango es desde **FT** hasta el último byte de **DATA**. No entran `1B 02`, ni el CRC, ni `1B 04`.
- El relleno `1B 1B` tampoco entra: el CRC se calcula sobre los bytes reales, antes de duplicar el ESC.

El uint16 resultante se escribe **CRC Hi** y después **CRC Lo** (el byte alto primero).

### Algoritmo del manual

Estado inicial `Crc = 0`. Por cada byte `SerData`:

```
Crc = (Crc >> 8) | (Crc << 8)     limitado a 16 bits en cada paso
Crc = Crc xor SerData
Crc = Crc xor ((Crc & 0xFF) >> 4)
Crc = Crc xor (Crc << 12)
Crc = Crc xor ((Crc & 0xFF) << 5)
```

Las dos últimas líneas son la forma corta de lo que el manual escribe como `(Crc << 8) << 4` y `((Crc & 0xFF) << 4) << 1`.

## 3.2.2 Ejemplo: Get Product Information

El manual arma este pedido (DATA = `02 01`):

```
1B 02 | 04 | 00 | 00 | 02 01 | FF 45 | 1B 04
```

| Campo | Bytes |
|---|---|
| Inicio | `1B 02` |
| FT, TA, FA | `04 00 00` |
| DATA | `02 01` |
| CRC | `FF 45` |
| Fin | `1B 04` |

Comprobado con el algoritmo de arriba, el CRC de `04 00 00 02 01` es `0xFF45`. Coincide con la tabla.

## Los pedidos ThermoKing cierran con el mismo CRC

No hace falta fiarse del hex copiado: se recalcula.

| Pedido | Bytes que entran al CRC | CRC obtenido | Hex que se transmite |
|---|---|---|---|
| Lectura 1, la de `d02` | `04 00 00 82 A7 10 00` | `CA E9` | `1B0204000082A71000CAE91B04` |
| Lectura 2, la de `d03` | `04 00 00 82 A7 10 01` | `DA C8` | `1B0204000082A71001DAC81B04` |

Un bit distinto en el subcomando (`00` frente a `01`) cambia todo el CRC. Por eso las dos tramas no comparten los últimos bytes antes del `1B 04`.

La respuesta se valida igual. Se toma desde el `1B 02` que sigue al IMEI, se quita el relleno, se calcula el CRC de FT hasta el fin del DATA y se compara con los dos bytes anteriores a `1B 04`. Si no coincide, esa respuesta no entra al JSON: el POST de ese minuto queda como error y se espera el ciclo siguiente.

## Qué hace la telemetría con esta página

- Generar cualquier pedido nuevo con este CRC, no pegando bytes a ojo.
- Rechazar una respuesta cuyo CRC no dé `0` al reaplicar el algoritmo sobre datos + CRC.
- Publicar en `d02` / `d03` solo la trama que pasó esa prueba, desde `1B 02` hasta `1B 04`, en hex, sin el IMEI y sin los `FF FF FF FF`.
