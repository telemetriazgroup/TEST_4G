# Página 5 — Standby y tipos numéricos

Secciones **2.4** y **2.5**.

## 2.4 Standby de la unidad (solo MP-4000)

Mientras el MP-4000 está en standby, el mecanismo que guarda en flash los valores cambiados **no está activo**. El manual desaconseja escribir consignas si el controlador no está en marcha.

Consecuencia para la telemetría:

- Leer (los dos pedidos `82 A7 10 …`) se puede hacer igual: no modifican la flash.
- Un comando que cambie setpoint, relé o modo no debería enviarse solo porque el socket está abierto. Hace falta saber que la unidad está corriendo. Esta página no dice cómo se detecta el standby; eso sale en las páginas de estado, más adelante.
- El MP-5000 no está mencionado en 2.4. La advertencia, tal como está escrita, es del MP-4000.

## 2.5 Términos

Todos los enteros del protocolo son **sin signo** en el ancho indicado. El signo y la coma los pone el formato Fp, no un complemento a dos aparte.

| Nombre | Ancho | Cómo se lee un ejemplo |
|---|---|---|
| Uint32 | 32 bit | Entero 0 … 4 294 967 295 |
| Uint16 | 16 bit | Entero 0 … 65 535 |
| Uint8 | 8 bit | Entero 0 … 255 |
| Fp1 | entero con exponente 0 | 1234 se muestra 1234.0 |
| Fp100 | exponente −1 | 1234 se muestra 123.4 |
| Fp10 | exponente −2 | 1234 se muestra 12.34 |
| Fp1000 | exponente −3 | 1234 se muestra 1.234 |

La coma se obtiene dividiendo el entero por 1, 10, 100 o 1000:

| Formato | Divisor | 1234 crudo |
|---|---:|---|
| Fp1 | 1 | 1234 |
| Fp100 | 10 | 123.4 |
| Fp10 | 100 | 12.34 |
| Fp1000 | 1000 | 1.234 |

El nombre no coincide con el divisor: **Fp100 divide entre 10** y **Fp10 divide entre 100**. Hay que usar la tabla, no el número del nombre.

En la trama, el Uint16 viaja en little-endian: primero el byte bajo, después el alto. Un sensor marcado Fp10 cuyo par de bytes es `2C 01` es el entero 300 y se publica como 3.00.

Los códigos especiales (valor no disponible, sensor abierto) no están en esta página. Aparecen en el mapa de cada respuesta; en el sensor readout se ven como `FE 7F` y no deben convertirse a temperatura.

## Qué hace la telemetría con esta página

Hoy el ciclo de la rama `test-tk` no escala estos números: reenvía el hex de la respuesta. Cuando se decodifique el bloque `82 A7 00` para el gráfico, cada campo usa el Fp de su fila y rechaza el standby como momento para escribir. El detalle de ese bloque está en `proceso_82A700.md`.
