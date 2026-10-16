# Página 8 — Campo de datos

Secciones **3.3** y **3.3.1**.

A partir de aquí el manual solo describe el interior del telegrama. El envoltorio (`1B 02` … CRC … `1B 04`) ya quedó en las páginas 6 y 7. Lo que cambia de un pedido a otro es el campo de datos.

## Mapa de un telegrama general

El manual numera desde el primer byte de la trama, incluido el inicio:

| Byte | Campo | Valor en un telegrama general | Rol |
|---:|---|---|---|
| 0 | ESC | `1B` | Inicio |
| 1 | SOF | `02` | |
| 2 | FT | `04` | Tipo de trama |
| 3 | TA | `00` | Dirección destino, sin uso |
| 4 | FA | `00` | Dirección origen, sin uso |
| 5 | Format | `82` | Formato de datos del telegrama general |
| 6 | Command | el número del comando | Qué se pide |
| 7 | Sub cmd. | el subcomando | Variante del comando |
| 8 … | Data | el resto | Carga útil |
| N−3 | CRC Hi | | |
| N−2 | CRC Lo | | |
| N−1 | ESC | `1B` | |
| N | EOF | `04` | Fin |

No todos los tipos de telegrama llevan subcomando. Los de sistema (formato `02`, página 10) ocupan el byte 6 con el comando y el dato empieza en el byte 7. Los generales, formato `82`, sí usan el byte 7 como subcomando y el dato de aplicación empieza en el byte 8.

Los dos pedidos del ciclo de lectura son telegramas generales:

| Byte | Lectura de `d02` | Lectura de `d03` |
|---:|---|---|
| 5 Format | `82` | `82` |
| 6 Command | `A7` | `A7` |
| 7 Sub cmd. | `10` | `10` |
| 8 | `00` | `01` |

`10` marca que es un pedido. En la respuesta ese mismo sitio pasa a `00` o `01`, y desde el byte 8 viene el volcado de sensores o de control. Por eso el identificador que se busca en el hex recibido es `82 A7 00` o `82 A7 01`, no `82 A7 10`.

## 3.3.1 Formato del campo de datos

El primer byte del campo de datos es el **Data format**, de 8 bits, y va de `00` a `FE`. Lo que sigue es dato de la aplicación. Todo byte definido que no traiga valor debe ir en `FF`, salvo que esa fila del manual diga otra cosa.

Ejemplo del manual: formato `A0` y después el dato.

### Excepción del `FF`

Si el Data format es `FF`, ese byte no es el formato: indica que el formato está en el byte siguiente. Se puede repetir.

| Bytes de formato | Formato real |
|---|---|
| `A0` … | `A0` |
| `FF A0` … | `A0`, con un `FF` de extensión delante |
| `FF FF A0` … | `A0`, con dos `FF` de extensión |

Eso permite alargar el código de formato sin romper a quien solo miraba un byte. Al leer, los `FF` iniciales del formato se saltan hasta el primer byte distinto de `FF`.

No hay que confundir este `FF` de extensión con el `FF` de “campo sin usar” ni con los cuatro `FF` que el módem pone entre el IMEI y el `1B 02`. Esos cuatro están fuera de la trama.

## Qué hace la telemetría con esta página

- Clasificar la trama por el byte 5. `82` es telegrama general (sensores y control). `02` es telegrama de sistema (identidad del equipo, página 10).
- En un `82`, leer comando en el byte 6 y subcomando en el byte 7.
- Tratar `FF` dentro del dato como “sin valor”, y una cadena de `FF` al principio del formato como extensión, no como dato.
