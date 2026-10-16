# Página 42 — Retrieve log file

Sección **4.5.2**. Baja el archivo que la página 41 dejó preparado. Sin ese `20` previo, este telegrama no tiene archivo que leer.

## Siguiente bloque

Subcomando `26`. El controlador devuelve el bloque que sigue y suma uno al contador de secuencia.

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `19` |
| 2 | Sub Command | `26` |

## Repetir el último

Subcomando `24`. Vuelve a mandar el último bloque pedido y no avanza el contador.

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `19` |
| 2 | Sub Command | `24` |

Sirve cuando el bloque anterior no se pudo usar. Un `26` en ese caso saltaría un tramo. El `24` pide otra vez el mismo.

## Respuesta

Se reconoce por `82 19 27`.

| Bytes | Qué es | Cómo se lee |
|---:|---|---|
| 3–6 | Bytes transferidos | Entero de 32 bits. Lo ya enviado, incluido este paquete |
| 7–8 | Secuencia | Entero de 16 bits. Empieza en cero |
| 9 en adelante | Data | El trozo del archivo |

El contador de bytes no es el largo de este paquete solo. Es el acumulado. Cuando alcanza el largo de archivo que contestó el `21`, la bajada está completa. La secuencia tiene que llegar en orden desde cero. Un salto se recupera con el `24`, no pidiendo el `26` siguiente.

El tope de cada paquete es el Message Length del prepare.

## Qué hace la telemetría con esta página

No está en el ciclo de cada minuto. Una bajada de log es una sesión propia: preparar, luego `26` hasta completar el largo, y `24` solo si hay que repetir un bloque. Esos bytes no se parten como `d02` ni como `d03`.
