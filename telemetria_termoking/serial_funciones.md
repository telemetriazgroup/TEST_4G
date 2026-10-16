# Funciones en el serial

Cada pedido de este protocolo se pega en el TX igual que los dos que ya salen cada minuto. El CRC de las tramas de abajo está calculado. En el RX se separa el IMEI, se busca el código de respuesta y el resto es el dato.

Solo puede haber un pedido en vuelo. Se manda uno, se espera el RX, y recién entonces el siguiente. Entre dos pedidos seguidos, el mismo espacio de cinco segundos del ciclo.

## Cómo se lee cualquier RX

El módem antepone el IMEI y cuatro `FF`. Eso no es la trama.

```
383639333837303635323735353438  ffffffff  1b0204000082a700 ... 1b04
```

| Trozo | Qué es |
|---|---|
| Hex antes de `ffffffff` | IMEI en ASCII. `383639...` es `869387065275548`. Va en `i` |
| `ffffffff` | Separador del módem. Se tira |
| Desde `1b02` hasta `1b04` | La trama. Es lo que se guarda |

Dentro de la trama, después de `04 00 00`, vienen formato, comando y subcomando. El dataset empieza en el byte siguiente.

| Se envió | En el RX hay que encontrar | El dato empieza después de |
|---|---|---|
| `82 A7 10` + request | `82 A7` + el mismo request | Esos tres bytes |
| `02 01` | `02 02` | Esos dos bytes |
| `02 04` | `02 03` | Esos dos bytes |
| `02 09 00` | `02 08` | Esos dos bytes |
| `82 19 20 …` | `82 19 21` | Esos tres bytes |
| `82 19 26` o `82 19 24` | `82 19 27` | Esos tres bytes |
| `82 19 30` | `82 19 31` | Esos tres bytes |
| `82 19 32 …` | `82 19 33` | Esos tres bytes |
| `82 A7 88 00` | `82 A7 88` y el byte de acción con el bit 7 en 1 (`80`) | El byte de acción |
| `82 A7 84 …` | `82 A7 85` | Esos tres bytes |

Un entero de 16 bits va con el byte bajo primero. `3C F6` es el valor `F63C`. Las temperaturas del mapa de sensores son Fp10 (se dividen entre 10). El setpoint del control es Fp100 (se divide entre 100). A partir de `7FF0` no es una lectura: en el cable se ve `FE 7F`, que es “no aplica”.

El ciclo de cada minuto solo manda las dos primeras filas de la tabla de lecturas. El resto se puede lanzar a mano desde el serial, una vez por conexión, para completar la ficha. No sustituyen a `d02` y `d03`.

## Lecturas: pegar y esperar

| Función | TX | Qué vuelve | Para qué sirve en el serial |
|---|---|---|---|
| Sensores | `1B0204000082A71000CAE91B04` | `82 A7 00` | Ya es `d02`. Temperaturas de carga, retorno, suministro, presiones, kWh. Mapa en las páginas 14 y 15 |
| Control | `1B0204000082A71001DAC81B04` | `82 A7 01` | Ya es `d03`. Setpoint, humedad, aire fresco, válvulas, si hay alarma. Mapa en la página 16 |
| Entradas y salidas | `1B0204000082A71002EAAB1B04` | `82 A7 02` | Presostatos, potencia y relés de fase. Página 17 |
| Rótulo | `1B0204000082A71003FA8A1B04` | `82 A7 03` | 11 caracteres del container ID. No es el IMEI. Página 18 |
| Inicio de viaje | `1B0204000082A710048A6D1B04` | `82 A7 04` | Seis bytes BCD `YY MM DD HH mm ss`. Página 19 |
| Configuración | `1B0204000082A710059A4C1B04` | `82 A7 05` | Offset de las cuatro sondas, refrigerante, largo y alto del contenedor. Página 20 |
| Alarmas | `1B0204000082A71006AA2F1B04` | `82 A7 06` | Hasta diez alarmas. Bits 0–11 = número, bit 15 = reconocida. Candidato a `d08`. Página 21 |
| Información A | `1B0204000082A71007BA0E1B04` | `82 A7 07` | Modo (tabla de la página 44), en rango, frío limitado, tratamiento de frío, multi-temperatura, módem. Página 22 |
| Información B | `1B0204000082A710084BE11B04` | `82 A7 08` | Versión, firmware, serie de hasta 20 caracteres y las fechas de seis bytes. Página 23 |
| Información C | `1B0204000082A710095BC01B04` | `82 A7 09` | Último ensayo: tipo, resultado y las dos fechas. Solo si el software es posterior a la 3.11. Página 24 |
| Información extendida | `1B0204000082A71020EE8B1B04` | `82 A7 20` | Container ID, serie del controlador, reloj y tres temperaturas en Fp10. Desde la versión 3.20. Página 25 |
| Todas las lecturas | `1B0204000082A710FFD4191B04` | Una trama larga | El request `FF` pide juntas las lecturas 0 a 9 y la `20`. Sirve para probar una vez qué contesta el equipo. No entra en el minuto: la respuesta es grande y deja el canal ocupado |
| Identidad de placa | `1B020400000201FF451B04` | `02 02` | 25 bytes: serie de hardware, versión, checksum, boot o aplicación. Página 10. A veces detrás llega sola la respuesta `02 03` con el nombre |
| Nombre de producto | `1B020400000204AFE01B04` | `02 03` | Texto hasta el primer `00`. Página 11 |
| Versión de aplicación | `1B02040000020900D2591B04` | `02 08` | Major, minor, revisión y build, byte bajo primero. Página 12 |

En Información A, el byte 0 del dataset es el modo: 0 refrigerado, 1 congelado, 3 a 5 deshielo, 28 PTI fallido, 29 PTI aprobado. La lista completa está en la página 44.

## Lecturas de estado con acción 0

Estas no usan el subcomando `10`. El byte que sigue al subcomando es la acción, y 0 significa “devuélveme el estado, no cambies nada”. En la respuesta ese byte vuelve con el bit 7 puesto: un 0 de pedido se ve como `80`.

| Función | TX | Qué mirar en el RX |
|---|---|---|
| Tratamiento de frío | `1B0204000082A788005BAB1B04` | Estado en el byte 1: 12 activo, 13 falta aceptar, 14 aceptado. Temperatura en Fp10. Página 34 |
| Multi-temperatura | `1B0204000082A78900689A1B04` | Diez pasos de temperatura y periodo, y el paso en curso en el byte 43. Página 35 |
| Silencio nocturno | `1B0204000082A78A003DC91B04` | Si la operación silenciosa está encendida y si la máquina está parada. Página 37 |
| Madurador | `1B0204000082A78C00976F1B04` | Estado 5 = inyectando. La lectura de etileno, en ppm, va en los bytes 13–14 y solo vale de 0 a 1000. Página 38 |

Si el equipo es anterior a la versión en que entró esa función, no hay respuesta. Eso no es un fallo del CRC.

## Log del controlador

Comando `19`, no `A7`. Primero se prepara el archivo. El ejemplo de abajo pide formato LogView, paquetes de hasta 128 bytes, archivo de hasta 65536 bytes y el log completo. Los largos van con el byte bajo primero.

| Paso | TX | Respuesta |
|---|---|---|
| Preparar | `1B0204000082192000800000000100005E111B04` | `82 19 21`: largo real del archivo y el nombre, terminado en `00` |
| Bloque siguiente | `1B02040000821926AED41B04` | `82 19 27`: acumulado de bytes, secuencia desde 0, y el trozo |
| Repetir el último | `1B020400008219248E961B04` | La misma `82 19 27`, sin avanzar la secuencia |
| Índices | `1B02040000821930DC231B04` | `82 19 31`: índice más viejo y más nuevo |
| Tramo desde el índice 0, máximo 128 bytes | `1B02040000821932000000008000324A1B04` | `82 19 33`: primer índice, último índice y los registros |

Se repite el `26` hasta que el acumulado iguala el largo que dio el `21`. El `24` solo si ese bloque no sirvió. El formato interno de cada registro del `33` no está en este manual.

## Escrituras

Estas también se pueden armar para el TX, y cambian el equipo. No van en el ciclo de cada minuto. El Do Set y el ID de contenedor llevan datos variables: el CRC de abajo no les sirve, hay que recalcularlo con el texto real.

| Función | Efecto si se manda | TX fijo, cuando lo hay |
|---|---|---|
| Inicio de viaje | Marca un viaje nuevo con el reloj del controlador. No contesta | `1B0204000082A78156DB1B04` |
| Soltar calibración | Suelta la calibración. No contesta | `1B0204000082A78266B81B04` |
| Calibrar | El controlador calibra. No contesta | `1B0204000082A78376991B04` |
| ID de contenedor | Escribe 11 caracteres. No contesta. DATA = `82 A7 80` + los 11 bytes | Se recalcula el CRC |
| Do Set | Cambia setpoint, arranca PTI, enciende, pausa o reinicia, según el índice de las páginas 30 y 31. Sí contesta `82 A7 85`. El byte 0 en `00` es aceptado | DATA = `82 A7 84` + 11 caracteres + índice + valor |
| Reset de software | Reinicia la aplicación. Se cae la sesión. No hay ACK | `1B0204000002050097341B04` |
| Reset al bootloader | Reinicia y se queda en el boot. Tampoco hay ACK | `1B0204000002050187151B04` |
| Firmware | Formato `01`, comandos `41`, `45` y `42`. Graba software en el controlador | No hay un hex de un solo pegado: es una secuencia de paquetes |

Para comprobar una escritura que no contesta, se vuelve a leer la función que la muestra. El viaje se confirma con el request 4. El rótulo, con el request 3. La calibración, con el request 5.
