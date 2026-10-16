# Página 23 — Information B

Sección **4.3.10**. Request 8. Identidad del equipo y la lista de fechas que el controlador recuerda. La respuesta se reconoce por `82 A7 08`.

## Pedido y respuesta

| Byte de dato | Pedido | Respuesta |
|---:|---|---|
| 0 | Format `82` | Format `82` |
| 1 | Command `A7` | Reply `A7` |
| 2 | Sub Command `10` | Sub Reply `08` |
| 3 | Request `08` | Dataset largo |

## Identidad

| Bytes | Qué es | Cómo se lee |
|---:|---|---|
| 0–3 | Versión de la aplicación | Cuatro bytes BCD, `A.B.C.D` |
| 4–7 | Versión de firmware | Cuatro bytes en hexadecimal, `12 45 9A CD` se muestra `12.45.9a.cd` |
| 8–11 | Equipment ID | Cuatro bytes, sin escala en esta página |
| 12–31 | Número de serie de la unidad | Hasta 20 caracteres. Si es más corto, termina en `00` |
| 32–51 | ID de unidad / contenedor | Los 20 bytes siguientes |
| 148–167 | Número de serie de unidad / reefer | Hasta 20 caracteres, con `00` si sobra |

El firmware no es BCD: el ejemplo del manual usa nibbles `9A` y `CD`, que no existen en BCD. Se imprimen en hex. La versión de aplicación sí es BCD, un byte por componente.

Los textos cortos acaban en cero. No se lee pasado ese cero ni se rellena con espacios hasta el byte 20. El ID de los bytes 32–51 ocupa el mismo ancho que la serie; la celda de formato de la tabla está escrita en la fila de la serie.

Estas series no son el IMEI del módem ni el container ID de 11 caracteres de la página 18. Son tres rótulos distintos y se guardan por separado.

## Fechas de seis bytes

Cada una ocupa seis bytes en el orden año, mes, día, hora, minuto y segundo, el mismo arreglo que el inicio de viaje de la página 19.

| Bytes | Momento |
|---:|---|
| 52–57 | Encendido |
| 58–63 | Último apagado |
| 64–69 | Último deshielo conocido |
| 70–75 | Inicio del tratamiento de frío |
| 76–81 | Fin previsto del tratamiento de frío |
| 82–87 | Inicio del ajuste multi-temperatura |
| 88–93 | Fin previsto de ese ajuste |
| 94–99 | Último PTI breve correcto |
| 100–105 | Último PTI completo correcto |
| 106–111 | Último PTI smart correcto |
| 112–117 | Última prueba de sondas en marcha |
| 118–123 | Último inicio de viaje |
| 124–129 | Hora del data logger |
| 136–141 | Inicio del medidor de energía |
| 142–147 | Inicio del viaje en el medidor |

Un bloque en cero o con un byte fuera de rango (mes 0, hora 24) es una fecha que el equipo nunca registró. No se sustituye por la hora del servidor.

## PTI smart y el fallo

| Bytes | Qué es | Cómo se lee |
|---:|---|---|
| 130–131 | Motivo del último PTI smart fallido | Dos bytes, sin tabla de códigos en esta página |
| 132 | PTI smart en uso | 0 deshabilitado. Cualquier otro valor, habilitado |
| 133 | Validez del PTI smart | 0 a 255 días |
| 134–135 | Estado del PTI smart | Entero de 16 bits, byte bajo primero, se conserva tal cual |

Estados nombrados del valor de 16 bits:

| Valor | Estado |
|---:|---|
| 0 | Vacío |
| 1 | Aprobado |
| 2 | Fallido |
| 3 | Aprobado y no guardado en el log |

## Qué hace la telemetría con esta página

El request 8 es ficha del equipo, no telemetría de cada minuto. Se pide al conectar. La hora del data logger (bytes 124–129) es la que el controlador cree que es “ahora”; el `fecha` del POST sigue siendo la llegada de la trama al servidor.
