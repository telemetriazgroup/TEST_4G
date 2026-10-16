# Página 10 — Get Product Information

Sección **4.2.1**. Es un telegrama de sistema: formato `02`, sin el subcomando de los telegramas `82`.

## 4.2.1.1 Pedido

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `02` |
| 1 | Command | `01` |

En la trama completa, con el envoltorio de la página 7:

```
1B 02 | 04 | 00 | 00 | 02 01 | FF 45 | 1B 04
```

El receptor tiene que contestar con la respuesta de esta sección. Puede, además, mandar el nombre de producto (página 11, respuesta `03`).

## 4.2.1.2 Respuesta

La tienen que poder armar tanto la aplicación como el bootloader.

| Byte de dato | Campo | Valor o tipo | Qué es |
|---:|---|---|---|
| 0 | Format | `02` | Telegrama de sistema |
| 1 | Reply | `02` | Número de esta respuesta |
| 2 | Identifier | byte | Formato de los campos que siguen: `00` o `02` |
| 3 | Hardware revision | byte | Revisión de hardware. El manual marca `00` como identificación única de esa revisión |
| 4 | Hardware type | byte | Tipo de hardware. El manual marca `18` |
| 5 | Boot loader capability | byte | Capacidad del bootloader |
| 6–9 | Boot loader release | BCD | `AAMMDDVV`: año, mes, día, versión |
| 10–13 | Hardware serial number | BCD | `AASSNNNN`: año, semana, número |
| 14–17 | Application check sum | 4 bytes | Suma de todo el medio de ejecución de la aplicación. Las direcciones sin usar cuentan como `FF` |
| 18 | Application type | byte | Identidad de la aplicación |
| 19–22 | Application release | BCD | `AAMMDDVV`: año, mes, día, versión |
| 23 | Run mode | byte | `0` bootloader, `1` aplicación |
| 24 | Application status | byte | Lo define la aplicación. Si no se usa, `FF` |

Son 25 bytes de dato (0 a 24). Si la trama trae menos, el campo que no llegó no es válido (página 9). Si trae más, lo nuevo está después del byte 24.

### Fechas en BCD

Cada nibble es un dígito decimal, no un entero binario.

| Campo | Ejemplo de bytes | Lectura |
|---|---|---|
| Boot o aplicación `AAMMDDVV` | `24 10 16 01` | 2024-10-16, versión 01 |
| Serie `AASSNNNN` | `26 41 00 12` | año 26, semana 41, número 0012 |

El byte se mira en hexadecimal y se lee como dos dígitos. `0x24` es el año 24, no el entero 36.

### Tipo de aplicación

El tipo evita cargar en una placa compartida una aplicación hecha para otro sistema. El sistema A y el sistema B llevan números de application type distintos. Si el número no corresponde, esa aplicación no pertenece a esa placa.

### Modo de marcha

| Run mode | Estado |
|---:|---|
| 0 | Está el bootloader. No hay aplicación de frío corriendo |
| 1 | Está la aplicación |

Encaja con la advertencia de standby de la página 5: con run mode 0 no tiene sentido pedir sensores ni escribir consignas. El ciclo `82 A7` corresponde a una unidad que contestó run mode 1, o que ya está enviando esas respuestas de datos.

## Qué hace la telemetría con esta página

- El pedido de identidad es `1B020400000201FF451B04`, una vez por conexión si se quiere ficha de equipo. No sustituye a los dos pedidos de cada minuto.
- La respuesta se reconoce por formato `02` y reply `02`.
- De ahí salen serie de hardware, versión, checksum y si está en boot o en aplicación. El IMEI del módem sigue siendo el `i` del JSON; este serial es otro número, el de la placa.
