# Página 11 — Nombre de producto y reset

Secciones **4.2.2** y **4.2.3**.

## 4.2.2 Get Product Name

Es opcional. Si el equipo lo tiene implementado, lo puede mandar a raíz de un Get Product Information. No hace falta un ciclo propio: llega como segunda respuesta del pedido `02 01`.

### Pedido

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `02` |
| 1 | Command | `04` |

Se usa solo si se quiere forzar el nombre. En el flujo normal basta con haber pedido Product Information y aceptar esta respuesta si aparece.

### Respuesta

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `02` |
| 1 | Reply | `03` |
| 2 … n | Application name | Texto del producto, terminado en `00` |

El nombre es una cadena C: bytes ASCII y un cero al final. El largo lo marca ese cero, no una cuenta previa. Si el cero no viene porque la trama se cortó, el nombre de esa recepción no se publica.

No es el IMEI ni el serial BCD de la página 10. Es la descripción del producto, por ejemplo el nombre de la aplicación que está cargada.

## 4.2.3 Software Reset

Al recibir este telegrama el controlador se reinicia. Si no entiende el modo de reset, igual se reinicia.

### Pedido

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `02` |
| 1 | Command | `05` |
| 2 | Reset mode | `00` reinicio incondicional. `01` quedarse o saltar al bootloader después del reset |

### Respuesta

No hay respuesta. El socket se cae o el equipo deja de contestar hasta que vuelve a arrancar. En Enviadas no aparece un ACK de este pedido: el silencio es el efecto esperado, no una trama perdida.

## Qué hace la telemetría con esta página

- Si detrás de un Product Information llega un reply `03`, guardar el texto hasta el `00` como nombre de aplicación de esa conexión.
- No enviar Software Reset en el ciclo de lectura ni al detectar la conexión. Reinicia el frío y la sesión TCP, y no aporta `d02` ni `d03`.
- El minuto siguiente sigue siendo solo `82 A7 10 00` y, cinco segundos después, `82 A7 10 01`.
