# Migración a un solo proyecto (`proyecto_principal`)

Este documento describe cómo pasar de varias ramas levantadas a un solo proyecto que administra puertos, guardado e interfaces. No cambia código, contenedores ni bases. El corte se hace después, de a un puerto, cuando este plan esté aceptado.

Fecha del inventario: 2026-10-16. Las cifras de Mongo son las de los contenedores que estaban corriendo ese día.

## 1. Lo que hay hoy

Hay un solo repositorio, `TEST_4G`, y ocho stacks de Docker corriendo a la vez. Siete se arrancaron desde la carpeta `/home/telemetriazgroup/Proyectos/TEST_4G` en momentos distintos, cada uno con la rama que estaba en disco en ese momento. USA es la excepción: tiene worktree en `/home/telemetriazgroup/Proyectos/usa/TEST_4G`.

Docker no sigue a Git. El contenedor sigue con la imagen y el `name:` con los que se creó, aunque la carpeta haya cambiado de rama. Por eso hoy la carpeta está en `test-tk` y, aun así, siguen vivos pollo, saasa, carne, starcool, gasificado y USA 9921, todos apuntando el archivo de compose de esa misma carpeta.

`main` quedó el 2026-09-04 y no sirve de base: no tiene puente homologado, ni ztrack, ni los perfiles. Todas las ramas útiles salen de `fa1fe55` (2026-09-09, “integracion pantalla interfaz ok”) y después se separaron. Ninguna contiene a las demás.

La rama local `test_tk` (guion bajo) no es Thermo King. Apunta al mismo commit que `test_usa_9921` (`9d673ab`). El trabajo de Thermo King está en `test-tk` (con guion).

## 2. Mapa de lo que está levantado

| Perfil | Rama | Proyecto Compose | TCP | Bridge | Backend | Serial | Ztrack | Mongo host | Base | Volumen |
|---|---|---|---|---|---|---|---|---|---|---|
| Pollo | `test_pollo` | `test_4g` (la rama no declara `name:`) | 9910 | 8081 | 9081 | 8089 | 8444 | 29017 | `test_4g` | `test_4g_mongo_data` |
| SAASA | `test-saasa` | `test_4g_saasa` | 9911 | 8082 | 9082 | 8090 | 8445 | 29018 | `test_4g_9911` | `test_4g_saasa_mongo_data_9911` |
| Carne | `test-carne` | `test_4g_carne` | 9912 | 8083 | 9083 | 8091 | 8446 | 29019 | `test_4g_9912` | `test_4g_carne_mongo_data_9912` |
| USA | `test-usa` | `test_4g_usa` | 9913 | 19801 | 19701 | 19601 | 8447 | 29020 | `test_4g_9913` | `test_4g_usa_mongo_data_9913` |
| Starcool | `test-starcool` | `test_4g_starcool` | 9914 | 8085 | 9085 | 8093 | 8448 | 29021 | `test_4g_9914` | `test_4g_starcool_mongo_data_9914` |
| Thermo King | `test-tk` | `test_4g_tk` | 9915 | 8086 | 9086 | 8094 | 8449 | 29022 | `test_4g_9915` | `test_4g_tk_mongo_data_9915` |
| Gasificado | `test-gasificado` | `test_4g_gasificado` | 9916 | 19800 | 19700 | 19600 | 8450 | 29023 | `test_4g_9916` | `test_4g_gasificado_mongo_data_9916` |
| USA 9921 | `test_usa_9921` | `test_4g_usa_9921` | 9921 | 8092 | 9092 | 8100 | 8455 | 29028 | `test_4g_9921` | `test_4g_usa_9921_mongo_data_9921` |

USA y gasificado mueven bridge, backend y serial a 19600–19800. El TCP del equipo sigue en 9913 y 9916. El resto usa la serie 8081…, 9081…, 8089…, 8444….

Hay un volumen suelto, `test_4g_mongo_data_9911`, creado el 2026-09-10 y sin contenedor. No se borra hasta inspeccionarlo: puede ser un Mongo de saasa anterior al volumen actual.

## 3. Qué se repite y qué cambia

El puente TCP es el mismo archivo en todas las ramas. La diferencia contra pollo son 4 líneas de puerto. Cada una hace lo mismo: escucha un TCP, parte tramas, avisa conexión y desconexión, y reenvía al backend.

El guardado también es el mismo esquema, creado al arrancar aunque no haya equipos:

| Colección | Para qué sirve |
|---|---|
| `sessions` | Una sesión por IP: activa o cerrada, conteo RX/TX, IMEI si se reconoció |
| `devices` | Estado vivo por `ip:puerto` |
| `messages` | Cada trama RX/TX en hex y texto, con `session_id` |
| `seguimiento` | Lectura ya decodificada (sensores, control, alarmas, snapshot) |
| `homologate_log` / `homologate_queue` | Cola e historial del POST saliente |
| `comandos` | Comandos armados, ventana, estado |
| `relay_labels` | Nombres de relés |
| `control_rules` | Reglas de la interfaz de pollo |

Encima de eso, cada rama añade un perfil. El perfil es lo único que justifica una rama distinta:

| Perfil | Qué hace de más | A dónde envía | Forma del JSON |
|---|---|---|---|
| Pollo | Portal de cliente: usuarios, zonas, relés, setpoints, programas, corrección de lecturas. Ocho commits que las otras ramas no tienen. Sigue pudiendo homologar Thermo King si hay URL. | `HOMOLOGATE_URL` vacío en el compose | `i`, `d01` = unidad, `d02` sensores, `d03` control, `d08` alarma |
| SAASA | Un TCP, ocho unidades. Manda `SAASA_UNITxxx_GET_DATA` de a una y atribuye la respuesta a esa consulta. Pestaña propia en el serial. | `http://161.132.53.51:9050/Starcool/` | `i`, `d01` = `SAASA`, `d02` = respuesta |
| Carne | Misma familia de tramas 82 A7 que Thermo King, con otro contrato de salida. | `http://161.132.53.51:9051/TermoKing/` | `i`, `d1` = sensores, `d2` = control, `d3` fijo, `d4` = unidad. Sin `d1` y `d2` no hay POST |
| Starcool | Por sesión manda el hex fijo `161613ffffffff8457`. La respuesta es IMEI más el sector que empieza en `161693`. Pestaña propia. | `http://161.132.53.51:9050/Starcool/` | `i` = IMEI, `d01` = `METRO`, `d02` = sector |
| Thermo King | Cada minuto, si hay sesión, pide sensores (`82 A7 10 00`) y control (`82 A7 10 01`), pausa ese ciclo durante una prueba manual, y decodifica en la pestaña. | `http://161.132.53.51:9050/TermoKing/` | `i` = IMEI, `d01` = `UNIT111`, `d02`, `d03`, `d08` vacío |
| USA, gasificado, USA 9921 | El mismo backend genérico de la época del fork, con otros puertos. No hay poller ni decodificador propio. Entre USA y gasificado el código difiere en un puñado de líneas de puerto. | URL de homologación vacía | La misma forma estándar de pollo, si algún día se llena la URL |

Ztrack no es igual. Pollo tiene el portal (Principal, Histórico, Alertas, Comandos, Reglas, Relés, Usuarios, Perfil, Corregir, Configuración). Las otras ramas se quedaron con la pantalla anterior, unos 2 200 líneas menos. Fusionar “la interfaz” significa tomar la de pollo y mostrarla solo en los puertos cuyo perfil la necesite.

El serial comparte pestañas: en vivo, histórico, archivo, enviados, estado, comandos, reglas. SAASA y Starcool agregan una pestaña de su ciclo. Thermo King reutiliza Comandos y Reglas para la prueba de lecturas y para decodificar una trama pegada.

## 4. Datos que realmente hay que conservar

El código pesa más que los datos locales. Seis de las ocho bases solo tienen las colecciones vacías que crea el arranque.

| Base | Qué hay | Qué implica para la copia |
|---|---|---|
| `test_4g` (pollo, ~1,5 MB) | 21 mensajes (2026-07-22 a 2026-09-09), 5 sesiones, 3 seguimientos, 9 dispositivos, 1 log de homologación, 2 comandos, 4 usuarios de cliente | Se copia tal cual. Los usuarios y las etiquetas de relé son configuración, no telemetría |
| `test_4g_9911` (saasa, ~30 MB) | 142 408 documentos en `saasa_envios`, del 2026-09-14 al 2026-10-16. Todos con estado `no_device`. No hay mensajes ni sesiones | Es el diario del ciclo (intentó consultar y no había equipo). Se conserva como auditoría. No es historia de sensores |
| `test_4g_9914` | Colección `starcool_envios` en cero, más el esquema vacío | Se copia el esquema para no perder el nombre de la colección |
| Carne, USA, Thermo King, gasificado, USA 9921 | Esquema vacío, ~172 KB de índices | No hay tramas locales que migrar. El puerto igual se registra para que el equipo siga entrando al mismo TCP |

Lo que el monitor de Thermo King mostró el 2026-10-16 (IMEI `869387065275548`, `d02`/`d03`, temperaturas) no está en el Mongo local de `test_4g_9915`. Ese documento vive en el servidor de `161.132.53.51`, que recibe el POST. Este proyecto no es dueño de esa base. La migración no la toca: el puerto unificado sigue publicando al mismo link y el historial remoto sigue creciendo ahí.

## 5. Forma recomendada

No se hace un merge de Git de las ocho ramas. `backend/main.py` tiene entre 2 100 y 2 700 líneas en cada una y las funciones de poller están metidas en ese archivo. Un merge cruzado mezcla pollers de SAASA, Starcool y Thermo King dentro del mismo ciclo.

Tampoco se deja “una carpeta por rama” como estado final. Esa regla sirvió para que no se pisaran los puertos. El costo es ocho backend, ocho Mongo, ocho serial y ocho ztrack que repiten el mismo programa.

La vía que encaja con el objetivo es una rama nueva, `proyecto_principal`, tomada de `test_pollo` (es la que tiene el portal y las correcciones de relé que las demás no recibieron). Encima se copian, como módulos de perfil y no como otro `main.py`, los archivos que solo existen en una rama:

- `backend/saasa.py` y su prueba, desde `test-saasa`
- `backend/starcool.py` y su prueba, desde `test-starcool`
- `backend/tk_analysis.py`, `backend/tk_probe.py` y la prueba, desde `test-tk`
- la variante de `build_standard` de carne (`d1`/`d2`/`d3`/`d4` y el puerto 9051), desde `test-carne`
- la documentación de protocolo (`telemetria_termoking/`, `ram_tcp.md`, casos SAASA y Starcool) se conserva en la misma rama, separada por perfil

`test_pollo` queda como fuente del núcleo. `test-tk`, `test-saasa`, `test-starcool` y `test-carne` quedan como fuente de un perfil. `test-usa`, `test-gasificado` y `test_usa_9921` no aportan lógica: solo reservan un TCP. `main` y la rama mal nombrada `test_tk` no se integran.

### Un proceso, muchos puertos

Un solo proyecto Compose, `proyecto_principal`, con un Mongo y un backend. El puente deja de ser “un programa copiado por rama” y pasa a ser un escuchador que abre cada TCP declarado. Un puerto nuevo no es un `git checkout` ni otro `docker compose up`.

Cada puerto es un documento, no una rama:

```text
puertos
  id              tk
  tcp             9915
  perfil          thermoking
  activo          sí
  salida.url      http://161.132.53.51:9050/TermoKing/
  salida.unidad   UNIT111
  salida.activo   sí
  vista.serial    sí
  vista.decodificar  sí
  vista.portal    no
  origen.base     test_4g_9915
  origen.volumen  test_4g_tk_mongo_data_9915
```

El backend, al arrancar y al crear un puerto, abre ese TCP (o le pide al puente que lo abra). El número TCP de los equipos actuales no cambia: 9910 sigue siendo pollo, 9911 SAASA, y así hasta 9921. Cambiar el puerto del equipo en campo no forma parte de esta migración.

El `port_cleaner` que hoy detiene cualquier contenedor que publique el TCP hay que limitarlo a este proyecto o quitarlo. En un host con ocho stacks, ese script apaga al vecino si el puerto coincide.

### Qué hace el perfil

El núcleo, igual para todos:

1. Acepta el TCP y registra sesión, dispositivo y trama.
2. Ofrece el serial genérico: hex, texto, envío manual, histórico de esa conexión.
3. Si el puerto tiene `salida.url`, encola un POST con reintentos y deduplicado. Sin URL, guarda y no envía.
4. Si el perfil tiene decodificador, llena `seguimiento` y la vista descifrada. Si no tiene, esa vista no aparece: no se inventa un decodificado.

Los perfiles concretos quedan así:

| Id de perfil | Ciclo automático | Decodificador | Portal de pollo |
|---|---|---|---|
| `generico` | ninguno | no | no |
| `pollo` | el de homologación Thermo King solo si la URL está puesta | el de sensores/control cuando la trama es 82 A7 | sí |
| `saasa` | GET_DATA por unidad, una a la vez | el parseo de `saasa.py` | no |
| `carne` | no agrega otro ciclo; usa la trama que ya entra | sensores/control, salida en `d1`…`d4` | no |
| `starcool` | hex fijo por sesión | IMEI + sector `161693` | no |
| `thermoking` | sensores y control cada minuto, con pausa si hay una prueba manual | páginas 14–16 y el decodificador ya alineado | no |
| `usa`, `gasificado`, `usa_9921` | ninguno, hasta que se defina el protocolo | no | no |

USA, gasificado y USA 9921 entran como `generico` con su TCP reservado. El día que tengan protocolo, se les asigna un perfil nuevo sin abrir otra rama.

### Interfaces

Una sola pantalla de serial, con un selector de puerto. Las pestañas comunes (en vivo, histórico, archivo, enviados, estado) leen `puerto_id`. La pestaña de ciclo o de decodificación se muestra solo si el perfil la tiene. Pegar una trama y ver el detalle byte a byte sigue existiendo para Thermo King; para un puerto genérico esa acción dice que ese perfil no tiene decodificador.

Una sola pantalla de portal, la de pollo, visible en los puertos con `vista.portal`. El resto no hereda usuarios, zonas ni relés de pollo.

Una pantalla de administración del proyecto, nueva, que no existe en ninguna rama:

- lista de puertos activos, con TCP, perfil, equipos conectados y último POST
- alta de puerto: número TCP libre, perfil, URL de salida, nombre de unidad, y si hace falta vista descifrada
- no pide una rama ni un compose nuevo

Crear un puerto genérico deja el serial y el guardado andando el mismo día. La vista descifrada aparece cuando el perfil tiene decodificador. Mandar a un link es opcional y se cambia sin redeploy: es un campo del documento.

## 6. Estructura de datos en la base única

Una instancia Mongo, una base `proyecto_principal`. No hace falta un motor por puerto. El aislamiento que hoy dan ocho bases pasa a ser el campo `puerto_id` en cada documento, con índice.

Colecciones compartidas, todas con `puerto_id`:

- `puertos` — el registro de arriba. Es configuración. Se respalda aparte de la telemetría.
- `sessions`, `devices`, `messages`, `seguimiento`
- `homologate_log`, `homologate_queue`, `comandos`, `relay_labels`, `control_rules`
- `client_users`, `zone_ranges` — solo tienen sentido con `puerto_id = pollo`. No se copian al puerto nuevo.
- `saasa_envios`, `starcool_envios` — se conservan con su nombre y se les agrega `puerto_id`. Meterlas en `homologate_log` perdería campos (`unit`, `command`, `cycle_id`) que el log genérico no tiene.

Documento de trama, después de migrar:

```text
messages
  _id            el mismo ObjectId de origen
  puerto_id      "pollo" | "saasa" | "tk" | ...
  addr, ip, direction, encoding, hex, text, ts, session_id, seguimiento
  origen_base    "test_4g"
  origen_id      copia del _id, por si hay que reconciliar
```

Índices mínimos: `(puerto_id, ts)`, `(puerto_id, ip, ts)`, `(puerto_id, session_id)`. En `saasa_envios`: `(puerto_id, ts)` y `(puerto_id, unit, ts)`.

Un puerto creado desde la interfaz nace con `puerto_id` nuevo y cero documentos de trama. No ve el histórico de otro puerto. Para ver el histórico de Thermo King se elige el puerto `tk`, no se crea uno nuevo.

### Conservar los datos y abrir otro puerto

Son dos operaciones distintas.

Conservar es copiar cada base vieja dentro de `proyecto_principal` etiquetando `puerto_id`, sin borrar el volumen de origen. El equipo sigue marcando el mismo TCP. Las consultas del serial filtran por ese id y muestran lo que antes estaba en la base de esa rama.

Abrir otro puerto crea un documento nuevo, un TCP que no esté en la tabla del apartado 2, y colecciones vacías para ese id. Si se elige perfil `generico`, hay serial y guardado, y el POST solo si se escribió una URL. Si se elige un perfil que ya existe (`thermoking`, `saasa`, `starcool`), el ciclo y el decodificador son los de ese perfil, pero los datos quedan separados por `puerto_id`. Sirve para un segundo equipo del mismo protocolo sin clonar la rama.

No se reasigna el histórico de un puerto a otro. Si un equipo se pasa de 9915 a un TCP nuevo, lo anterior sigue bajo `tk` y lo nuevo bajo el id nuevo.

## 7. Procedimiento de copia

Se hace con los stacks viejos todavía arriba, en lectura. No se usa `docker compose down` global. El orden es: copiar, comprobar conteos, recién después cortar el TCP de ese puerto.

1. Crear la rama `proyecto_principal` desde `test_pollo` y llevar los módulos de perfil. Eso es trabajo de código, posterior a este documento.
2. Levantar el Mongo nuevo con un volumen nuevo, `proyecto_principal_mongo`, en un puerto de host que no esté ocupado (no reutilizar 29017–29023 ni 29028).
3. Por cada base de la tabla del apartado 2, `mongodump` desde el contenedor que ya corre y `mongorestore` hacia la base nueva, a un nombre temporal `import_<perfil>`.
4. Un script de copia, idempotente, lee `import_<perfil>` y escribe en las colecciones definitivas con `puerto_id`. La clave de no duplicar es `(puerto_id, origen_base, origen_id)`. Correrlo dos veces no duplica.
5. Comprobar conteos. Tienen que cerrar así:
   - pollo: 21 `messages`, 5 `sessions`, 3 `seguimiento`, 9 `devices`, 4 `client_users`, 2 `comandos`, 1 `homologate_log`
   - saasa: 142 408 `saasa_envios`, todos `no_device`, y el resto en cero
   - starcool: `starcool_envios` en cero
   - las otras cinco: cero documentos de negocio
6. Sembrar `puertos` con las ocho filas del apartado 2, la URL real de cada uno y el perfil. USA, gasificado y USA 9921 quedan con URL vacía, como hoy.
7. Inspeccionar el volumen huérfano `test_4g_mongo_data_9911` con un `mongodump` de solo lectura. Si tiene `saasa_envios` o `messages` que no estén en el volumen actual, se importan con `puerto_id = saasa` y un `origen_base` distinto para no pisar. Si está vacío o es un duplicado, se deja sin borrar hasta el final.
8. Recién ahí se corta un puerto: se detiene solo el `tcp_bridge` viejo de ese TCP y el escuchador nuevo lo toma. El backend y el Mongo viejos siguen un día más, por si hay que volver. El retorno es volver a levantar ese bridge; el volumen no se tocó.
9. Cuando los ocho TCP estén en el proceso nuevo y un día de tráfico nuevo coincida con lo que antes se veía en el serial, se apagan los backend y Mongo viejos. Los volúmenes se archivan, no se borran en el mismo paso.

El POST al link remoto no se reescribe ni se reenvía el histórico. Esos servidores ya tienen su copia. Reenviar 142 408 intentos `no_device` de SAASA no aporta y duplicaría ruido.

### Qué no se mezcla

- Usuarios y zonas de pollo no se copian a Thermo King ni a SAASA.
- El JSON de carne (`d1`…`d4`, puerto 9051) no se unifica con el de Thermo King (`d02`/`d03`, puerto 9050). Son dos perfiles que comparten decodificador de trama y difieren en la salida.
- SAASA y Starcool publican al mismo host `9050/Starcool/` con cuerpos distintos. Cada puerto conserva su URL y su cuerpo. Compartir host no significa compartir perfil.
- El IMEI sigue siendo el identificador de equipo. El id de contenedor no lo reemplaza.

## 8. Orden de corte sugerido

De menor riesgo a mayor, un TCP por vez, comprobando el serial de ese puerto antes de seguir:

1. USA 9921 (9921) — base vacía, sin ciclo propio. Sirve de ensayo del escuchador.
2. Gasificado (9916) y USA (9913) — igual de vacíos. Ojo con sus puertos HTTP altos; en el proyecto único el serial deja de ser 19600/19601 y pasa al selector. El TCP del equipo no se mueve.
3. Carne (9912) y Starcool (9914) — vacíos en local, pero con perfil de salida. Hay que ver un POST de prueba contra el mismo link antes de dejar el ciclo andando.
4. Thermo King (9915) — hay equipos reales y el ciclo de un minuto. El corte se hace fuera de una prueba manual. Se confirma que el POST sigue saliendo a `9050/TermoKing/` con `d02` y `d03`.
5. SAASA (9911) — el ciclo está vivo (el último `no_device` es del mismo día del inventario). Se corta cuando el ciclo nuevo registre el mismo estado sin duplicar la colección.
6. Pollo (9910) al final — es el único con usuarios, mensajes y seguimiento. El portal tiene que entrar con los mismos cuatro usuarios después de la copia.

Pollo, además, no declara `name:` en el compose. Su proyecto se llama `test_4g` por el nombre de la carpeta. Cualquier `docker compose` lanzado en `/home/telemetriazgroup/Proyectos/TEST_4G` sin `name:` puede intentar gobernar esos contenedores. Hasta el corte, no se arranca otro compose en esa carpeta sin `name:` explícito.

## 9. Qué queda resuelto y qué no

Queda resuelto con este diseño:

- Un solo proceso para todos los TCP que hoy están activos, con los mismos números.
- Alta de un TCP nuevo, con serial genérico, sin rama ni carpeta nueva.
- URL de salida editable por puerto.
- Vista descifrada solo donde el perfil sabe decodificar.
- Histórico local conservado y separable por puerto.
- Posibilidad de un segundo puerto con el mismo perfil y datos propios.

No queda resuelto aquí, y no debe colarse en la implementación:

- Traer al Mongo local el historial que ya está en `161.132.53.51`.
- Definir el protocolo de gasificado, USA y USA 9921. Hoy no existe en el código.
- Unificar los contratos `d1`/`d2` de carne y `d02`/`d03` de Thermo King.
- Reescribir `main.py` de las ramas viejas. Esas ramas se congelan cuando el puerto equivalente esté cortado. No se siguen desarrollando en paralelo.
- Borrar volúmenes, la rama `test_tk` mal nombrada, ni `main`.

## 10. Comprobación antes de dar por buena la migración

Para cada puerto cortado:

- El TCP anterior acepta conexión y el serial del proyecto único muestra la trama con el `puerto_id` correcto.
- Un puerto no lista tramas de otro.
- Si tenía URL, el POST sale al mismo host y con el mismo cuerpo que antes.
- Los conteos del apartado 7 siguen igual después del corte; el tráfico nuevo se suma, no reemplaza.
- Crear un puerto de prueba en un TCP libre (por ejemplo uno fuera de 9910–9916 y 9921) deja serial y guardado, no abre decodificador si el perfil es `generico`, y no modifica las colecciones de los puertos viejos.
- Volver a levantar el bridge viejo de ese TCP recupera el comportamiento anterior porque su volumen no se modificó.
