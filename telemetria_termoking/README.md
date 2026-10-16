# Telemetría ThermoKing — análisis del protocolo MP-4000 / MP-5000

Análisis página por página del documento **MP-4000 / MP-5000 External COM Protocol** (Copeland, revisión 2024-10-23, 45 páginas). Cada archivo cubre una página del PDF y qué implica para la telemetría que habla el puerto TCP **9915**.

El módem 4G no cambia este protocolo: en el socket llega la misma trama que el controlador entregaría por el puerto serie. Aquí el servidor es el maestro y el equipo es el esclavo. Solo puede haber un pedido pendiente.

| Página del PDF | Archivo | Qué queda definido |
|---:|---|---|
| 4 | [pagina_04.md](pagina_04.md) | Cómo se enchufa el MP-4000 y el MP-5000, y los parámetros del puerto |
| 5 | [pagina_05.md](pagina_05.md) | Standby del MP-4000 y la escala de los números |
| 6 | [pagina_06.md](pagina_06.md) | Forma de la trama: inicio, campos, relleno de `1B`, cierre |
| 7 | [pagina_07.md](pagina_07.md) | CRC-CCITT y el ejemplo Get Product Information |
| 8 | [pagina_08.md](pagina_08.md) | Campo de datos: formato `82`, comando, subcomando y el hueco `FF` |
| 9 | [pagina_09.md](pagina_09.md) | Los telegramas crecen por el final y solo vale lo que llegó |
| 10 | [pagina_10.md](pagina_10.md) | Get Product Information: pedido `02 01` y los 25 bytes de identidad |
| 11 | [pagina_11.md](pagina_11.md) | Nombre de producto y reset de software, que la telemetría no debe disparar |
| 12 | [pagina_12.md](pagina_12.md) | Versión de aplicación: pedido `02 09` y números en little-endian |
| 13 | [pagina_13.md](pagina_13.md) | Pedido de lectura `82 A7 10`: el `00` es sensores y el `01` es control |
| 14 | [pagina_14.md](pagina_14.md) | Respuesta de sensores y el mapa hasta la frecuencia de línea |
| 15 | [pagina_15.md](pagina_15.md) | Resto del mapa: corrientes, CO₂, O₂, kWh y temperaturas de apoyo |
| 16 | [pagina_16.md](pagina_16.md) | Control readout: el `d03`, setpoint, humedad y válvulas |
| 17 | [pagina_17.md](pagina_17.md) | Entradas y salidas: presostatos, potencia y relés de fase |
| 18 | [pagina_18.md](pagina_18.md) | Texto de rótulo: el ID del contenedor, distinto del IMEI |
| 19 | [pagina_19.md](pagina_19.md) | Inicio del viaje en seis bytes BCD |
| 20 | [pagina_20.md](pagina_20.md) | Configuración: offset de las sondas de carga, equipo y contenedor |
| 21 | [pagina_21.md](pagina_21.md) | Hasta diez alarmas; el request 6 es el bloque `82 A7 06` |
| 22 | [pagina_22.md](pagina_22.md) | Información A: modo, en rango, tratamiento de frío y estado del módem |
| 23 | [pagina_23.md](pagina_23.md) | Información B: versiones, serie y las fechas de seis bytes |
| 24 | [pagina_24.md](pagina_24.md) | Información C: último ensayo, su tipo y si pasó |
| 25 | [pagina_25.md](pagina_25.md) | Request `20`: contenedor, serie, reloj y tres temperaturas en Fp10 |
| 26 | [pagina_26.md](pagina_26.md) | Escritura del ID de contenedor; el controlador no contesta |
| 27 | [pagina_27.md](pagina_27.md) | Marca un inicio de viaje; la telemetría no lo envía |
| 28 | [pagina_28.md](pagina_28.md) | Suelta la calibración; el controlador no contesta |
| 29 | [pagina_29.md](pagina_29.md) | Ordena calibrar; el controlador no contesta |
| 30 | [pagina_30.md](pagina_30.md) | Do Set: el índice 0–43 cambia setpoint, ensayos y el equipo |
| 31 | [pagina_31.md](pagina_31.md) | Resto del Do Set: valor, modo de control y componentes del MFT |
| 32 | [pagina_32.md](pagina_32.md) | Respuesta del Do Set: código `82 A7 85` y por qué se rechazó |
| 33 | [pagina_33.md](pagina_33.md) | Interfaz vieja de CT/MTS, solo de depuración |
| 34 | [pagina_34.md](pagina_34.md) | Tratamiento de frío: pedido `88` y su respuesta |
| 35 | [pagina_35.md](pagina_35.md) | Multi-temperatura: diez pasos en el pedido `89` |
| 36 | [pagina_36.md](pagina_36.md) | Paso activo y código de respuesta del multi-temperatura |
| 37 | [pagina_37.md](pagina_37.md) | Silencio nocturno (`8A`) y el arranque del madurador (`8C`) |
| 38 | [pagina_38.md](pagina_38.md) | Etileno: consigna, espera, duración y la lectura en ppm |
| 39 | [pagina_39.md](pagina_39.md) | Firmware: prólogo y paquetes de código, formato `01` |
| 40 | [pagina_40.md](pagina_40.md) | Epílogo del firmware; la telemetría no lo envía |
| 41 | [pagina_41.md](pagina_41.md) | Preparar el archivo de log: comando `19`, subcomando `20` |
| 42 | [pagina_42.md](pagina_42.md) | Bajar el log por bloques, y repetir el último sin avanzar |
| 43 | [pagina_43.md](pagina_43.md) | Log por índice: el más viejo, el más nuevo y un tramo |
| 44 | [pagina_44.md](pagina_44.md) | Modo de la unidad: los códigos 0 a 29 del byte 0 de Información A |

El análisis cubre las páginas 4 a 44. El PDF marca 45; la 45 no vino en este juego. La sección que cierra el manual recibido es la 5.1, el modo de la unidad.

Los pedidos del ciclo (`82 A7 10 00` y `82 A7 10 01`) quedan explicados en la página 13. El mapa del bloque `82 A7 00` está en las páginas 14 y 15 y, ya aplicado a una trama real, en [proceso_82A700.md](../proceso_82A700.md). El JSON que se publica está en [thermoking.md](../thermoking.md).

El hex listo para pegar en el TX del serial, función por función, está en [serial_funciones.md](serial_funciones.md).
