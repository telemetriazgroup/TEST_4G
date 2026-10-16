# Página 6 — Descripción de la trama

Secciones **3** y **3.1**.

El protocolo es maestro/esclavo. **Solo un pedido puede estar pendiente.** Por eso los dos hex del ciclo no se mandan juntos: el segundo sale cinco segundos después del primero, cuando la respuesta del primero ya tuvo tiempo de llegar.

## Inicio y fin

| Secuencia | Bytes | Rol |
|---|---|---|
| Start of transmission | `1B 02` | ESC + SOF. Abre la trama |
| End of transmission | `1B 04` | ESC + EOF. La cierra |

Todo lo que está entre esas dos marcas es la trama útil más el CRC. Lo que el módem pone delante (el IMEI en ASCII y `FF FF FF FF`) **no pertenece** a esta trama. Se separa antes de buscar el `1B 02`.

## Relleno del byte ESC

Dentro de la trama, un `1B` que no sea el inicio ni el fin se duplica: se transmite `1B 1B`. Si no se hace, el receptor creería que ahí empieza o termina otra trama.

Ejemplos del manual, ya con el relleno aplicado al transmitir:

| Antes de rellenar | En el cable |
|---|---|
| `AA 1B DD 1B 04 EE` | `AA 1B 1B DD 1B 1B 04 EE` |
| `AA 1B DD 1B 1B 04 EE` | `AA 1B 1B DD 1B 1B 1B 1B 04 EE` |

El relleno se aplica **después** de calcular el CRC, desde el tipo de trama hasta el CRC bajo, y **antes** de poner `1B 02` y `1B 04`. Para leer hay que hacer lo contrario: quitar el `1B` extra y recién ahí comprobar el CRC.

`1B 02` y `1B 04` de los bordes no entran en el CRC ni se tratan como dato relleno.

## Campos

| Campo | Bytes | Nombre en el manual | En la telemetría |
|---|---:|---|---|
| Start | 2 | ESC SOF | Siempre `1B 02` |
| Type | 1 | FT, frame type | En los pedidos y respuestas vistos, `04` |
| Address | 1 | TA, to address | Siempre `00`. El manual dice que no se usa y no puede ser distinto de cero |
| Address | 1 | FA, from address | Siempre `00`. Igual que TA |
| Data | 0 … 245 | DATA | El comando o la respuesta |
| CRC | 2 | CRC Hi, CRC Lo | CRC-CCITT de la página 7. Hi es el byte alto |
| End | 2 | ESC EOF | Siempre `1B 04` |

FT dice qué clase de marco es. TA y FA no identifican a la unidad: la unidad se conoce por la conexión TCP y por el IMEI que el módem antepone. Por eso en el JSON el identificador `i` es el IMEI, no estos dos ceros.

DATA cabe hasta 245 bytes. Las respuestas de sensores ocupan casi todo ese cupo; un pedido corto ocupa 4 bytes (`82 A7 10 00` o `82 A7 10 01`).

## Los dos pedidos del ciclo, ya partidos

Pedido del bloque que se publica en `d02`:

```
1B 02 | 04 | 00 | 00 | 82 A7 10 00 | CA E9 | 1B 04
```

Pedido del bloque que se publica en `d03`:

```
1B 02 | 04 | 00 | 00 | 82 A7 10 01 | DA C8 | 1B 04
```

| Trozo | Significado |
|---|---|
| `1B 02` | Inicio |
| `04 00 00` | FT, TA, FA |
| `82` | Formato de telegrama de sistema |
| `A7` | Familia de lectura (sensor / control, según el subcomando que sigue) |
| `10` | Es un **pedido**. La respuesta cambia este byte a `00` o `01` |
| `00` o `01` | Cuál de las dos lecturas se pide |
| `CA E9` / `DA C8` | CRC de `04 00 00` + los cuatro bytes de dato |
| `1B 04` | Fin |

La respuesta que vuelve trae el mismo envoltorio. El dato ya no es el pedido de 4 bytes: es el volcado, y el byte de subcomando baja de `10` a `00` (primera lectura, `d02`) o queda en el código de la segunda (`d03`, opcode `82 A7 01`). El hex completo de esa respuesta, desde `1B 02` hasta `1B 04`, es lo que se copia a `d02` o `d03`. El IMEI y los cuatro `FF` se quedan fuera.

## Qué hace la telemetría con esta página

1. En cada conexión, esperar a que no haya otro pedido en vuelo.
2. Escribir el primer hex y esperar la trama que cierra en `1B 04` y trae `82 A7 00`.
3. Cinco segundos después, escribir el segundo hex y esperar `82 A7 01`.
4. Repetir el par cada minuto.
5. Antes de fiarse del dato, desrellenar `1B 1B` y comprobar el CRC de la página 7.
