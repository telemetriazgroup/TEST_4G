# Página 31 — Do Set, continuación

Sigue la sección **4.3.17**. Completa los índices, el formato del valor y dos tablas que el manual ata al control readout `82 A7 01`.

## Índices 44 a 50

| Índice | Qué hace | Valor |
|---:|---|---|
| 44 | Intervalo de log | Segundos. Tiene que ser uno de los que el menú del equipo acepta |
| 45 | Configuración del calentador | 0 normal, 1 extendido |
| 46 | Auto config | 0 apagado, 1 encendido |
| 47 | Uso interno | No se usa |
| 48 | Uso interno | No se usa |
| 49 | Prueba manual de función (MFT) | 0 parar, 1 arrancar |
| 50 | Dentro del MFT, activar o soltar un componente | Ver la máscara de abajo |

## El valor, desde el byte 13

El mismo desplazamiento cambia de formato según el índice.

| Para qué índice | Cómo se escribe |
|---|---|
| Un número | 32 bits, byte más bajo primero. `12345678` viaja como `78 56 34 12` |
| Fecha y hora en BCD | Doce dígitos hex `YY MM DD HH mm ss` |
| Nombre de quien ordena | Texto de hasta 80 caracteres, con un `00` al final |
| Fecha y hora en ASCII | Doce caracteres `YYMMDDHHmmss`. El año es el del siglo 2000 |
| ID de contenedor | Cuatro letras, seis dígitos y un dígito de control. Ejemplo `LOSU1234567` |

`100202235934` en ASCII es el 2 de febrero de 2010 a las 23:59:34. No es el BCD de la página 19: allí el año 2010 sería el byte `10`, no los caracteres `1` y `0`.

## Modo de control (índice 10)

El manual usa el mismo número en el Do Set y en el control readout. En el MP-4000 el menú se llama Controlling Mode. En el MP-3000 el equivalente es Econ Mode, y solo distingue apagado y encendido.

| Número | MP-3000, Econ Mode | MP-4000, Controlling Mode |
|---:|---|---|
| 0 | Apagado | No optimizado |
| 1 | Encendido | Optimizado |
| 2 | Reserva | Reserva |
| 3 | Reserva | Reserva |
| 4 | Reserva | Reserva |
| 5 | | Bulb mode, cíclico |
| 6 | | Bulb mode, baja |
| 7 | | Bulb mode, alta |

Los números 2, 3 y 4 no tienen nombre de menú. No se envían.

## Componentes del MFT (índice 50)

El parámetro es el entero de 32 bits. El byte más bajo elige el componente. El byte siguiente vale 1 para activar y 0 para desactivar.

| Byte bajo | Componente | Byte siguiente en 1 |
|---:|---|---|
| 1 | Inversión de fase | Invertida. En 0, sentido normal. `00000101` invierte |
| 2 | Calentador | Activado |
| 3 | Compresor | Activado |
| 4 | Ventilador del evaporador, alta | Activado. `00000401` lo enciende |
| 5 | Ventilador del evaporador, baja | Activado |
| 6 | Ventilador del condensador | Activado |
| 7 | Válvula economizadora | Activado |
| 8 | Válvula digital | Activado |

Cualquier otro valor de ese segundo byte desactiva el componente. El MFT solo tiene sentido con el índice 49 en arranque. No es una lectura de los relés: los relés de marcha se leen en la página 17.

## Qué hace la telemetría con esta página

El índice 10 explica el modo que puede aparecer en el `d03`, no un comando del minuto. El 49 y el 50 mueven compresor, ventiladores y válvulas a mano. No salen por el enlace de telemetría.
