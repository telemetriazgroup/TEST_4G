# Página 44 — Unit Mode

Sección **5**. Interpretaciones. La **5.1** es la tabla del modo de la unidad. Es el byte 0 de Información A, el request 7 de la página 22. Un solo byte, de 0 a 29.

| Valor | Modo |
|---:|---|
| 0 | Refrigerado |
| 1 | Congelado |
| 2 | Planta parada |
| 3 | Deshielo, inicio |
| 4 | Deshielo |
| 5 | Deshielo terminado |
| 6 | Prueba de función, inicio |
| 7 | Prueba de función |
| 8 | PTI breve, inicio |
| 9 | PTI de refrigerado, inicio |
| 10 | PTI AFAM+, inicio |
| 11 | PTI de humedad relativa, inicio |
| 12 | PTI, inicio |
| 13 | PTI |
| 14 | Prueba de función manual, inicio |
| 15 | Prueba de función manual |
| 16 | Prueba de sondas en marcha |
| 17 | Prueba automática de la unidad |
| 18 | Autoconfiguración de la unidad |
| 19 | Prueba externa, inicio |
| 20 | Prueba externa |
| 21 | Inicio de apagado. Uso interno |
| 22 | Apagado. Uso interno |
| 23 | Fin de apagado. Uso interno |
| 24 | PTI, tirando a refrigerado |
| 25 | PTI, manteniendo refrigerado |
| 26 | PTI, en deshielo |
| 27 | PTI, tirando a congelado |
| 28 | PTI terminado, no pasó |
| 29 | PTI terminado, pasó |

Los modos 0 y 1 son la marcha normal: refrigerado o congelado. Del 3 al 5 la unidad está en deshielo, no en setpoint. Del 6 al 20 y del 24 al 29 está en una prueba. El 28 y el 29 cierran el PTI. Coinciden con el resultado de la página 24: fallido o aprobado. Los códigos 21, 22 y 23 son internos. No se muestran como un modo de operación.

Un byte fuera de 0 a 29 no se traduce con esta tabla.

## Qué hace la telemetría con esta página

El request 7 sigue fuera del minuto. Cuando se lea, el byte 0 se muestra con este nombre. Refrigerado y congelado son modo de trabajo. Deshielo y PTI explican una temperatura que no está en el setpoint sin tratarla como una sonda mala.
