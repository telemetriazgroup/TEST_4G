# Página 30 — Do Set

Sección **4.3.17**. Es la escritura general del controlador. Cambia setpoints y dispara comportamientos de la unidad. El subcomando es `84`. La lista sigue en la página 31.

## Pedido

| Byte de dato | Campo | Valor |
|---:|---|---|
| 0 | Format | `82` |
| 1 | Command | `A7` |
| 2 | Sub Command | `84` |
| 3 … | Data | El dataset de abajo |

## Cómo va armado

| Bytes del dataset | Qué es |
|---:|---|
| 0–10 | ID del contenedor, 11 caracteres |
| 11–12 | Índice de lo que se va a cambiar, entero de 16 bits, byte bajo primero |
| 13 en adelante | El valor. El formato depende del índice y está en la página 31 |

El contenedor del telegrama tiene que ser el de la unidad. Un Do Set dirigido a otro rótulo no se aplica aquí.

## Índices 0 a 43

La escala es la del valor que se escribe. Fp100 se divide entre 100. Fp1 es el entero tal cual.

| Índice | Qué hace | Valor |
|---:|---|---|
| 0 | Setpoint de temperatura | Fp100 °C |
| 1 | Fin de deshielo | Fp100 °C |
| 2 | Setpoint de O₂ | Fp100 % |
| 3 | Setpoint de CO₂ | Fp100 % |
| 4 | Setpoint de humedad | Fp100 % |
| 5 | Caudal de aire fresco | Fp1 cmh |
| 6 | Intervalo de deshielo | Fp1 s |
| 7 | Uso interno | No se usa |
| 8 | Modo de humedad | |
| 9 | Modo de aire fresco | |
| 10 | Modo de control | La tabla está en la página 31 |
| 11 | Retardo del aire fresco | Segundos |
| 12 | Activar inicio de viaje | Sin parámetros |
| 13 | Poner la hora del controlador | |
| 14 | Arrancar prueba de función | Sin parámetros |
| 15 | Arrancar PTI | Sin parámetros |
| 16 | Arrancar PTI breve | Sin parámetros |
| 17 | Arrancar PTI de refrigerado | Sin parámetros |
| 18 | Arrancar PTI AFAM+ | Sin parámetros |
| 19 | Arrancar PTI de humedad relativa | Sin parámetros |
| 20 | Arrancar prueba de sondas | Sin parámetros |
| 21 | Arrancar deshielo | Sin parámetros |
| 22 | Arrancar deshielo extendido | Sin parámetros |
| 23 | Condensador enfriado por agua | 0 apagado, 1 encendido |
| 24 | Volver a operación normal | |
| 25 | Escribir el ID del contenedor | |
| 26 | Reconocer un número de alarma | |
| 27 | Uso interno | No se usa |
| 28 | Uso interno | No se usa |
| 29 | Encender o apagar | 0 apagado, 1 encendido. Solo MP-4000, el botón del frente |
| 30 | Pausar la unidad, parar la maquinaria | |
| 31 | Aceptar el estado del PTI y seguir | Texto con el nombre de quien ordena |
| 32 | Guardar el Smart PTI | Texto con el nombre de quien ordena |
| 33 | Guardar un texto en el log | |
| 34 | Uso interno | No se usa |
| 35 | Setpoint de humedad | Fp100. El control de humedad tiene que estar activo para que el cambio valga |
| 36 | Reconocer el estado del PTI | Seguir y, si aplica, aceptar el Smart PTI |
| 37 | Poner a cero el medidor de energía | |
| 38 | Reiniciar el controlador | |
| 39 | Largo del contenedor | |
| 40 | Alto del contenedor | |
| 41 | Serie de la unidad | Espera 10 caracteres |
| 42 | ID de la unidad | Espera 12 caracteres |
| 43 | Refrigerante | 1 R404a, 2 R452a, 3 R134a, 4 R513a, 5 R1234yf |

Los índices 7, 27, 28 y 34 son de uso interno del fabricante. La telemetría no les pone valor.

El 12 repite, por otro camino, el inicio de viaje de la página 27. El 25 repite la escritura del rótulo de la página 26. El 29 corta o da marcha a la unidad. El 38 la reinicia. El 37 borra el acumulado de energía que se lee en el mapa de sensores.

## Qué hace la telemetría con esta página

No se envía en el ciclo. Leer un setpoint es el request 1; cambiarlo es este `84`, y son cosas distintas. Un Do Set solo sale si un operador lo pide, con el índice y el valor ya revisados, y después se confirma leyendo el bloque que corresponda.
