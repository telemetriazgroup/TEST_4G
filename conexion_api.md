actualmente tenemos la data que llega al puerto 9917 que es de la manera como esta como el en archivo historico_hora_todos_2026-11-11_21_00_2026-11-12T03-23-45.json , que e sun json que corresponde a la hora 21:00 del 11-11-2026 gmt-5 , el objetivo es juntar los datos para homologarlos y enviarlos a un link api para que sean recibidos :

## Link

| Variable | Valor por defecto |
|---|---|
| `HOMOLOGATE_URL` | `http://161.132.53.51:9051/TermoKing/` |
| `HOMOLOGATE_ENABLED` | `1` |
| `HOMOLOGATE_TIMEOUT_S` | `5` |
| `HOMOLOGATE_RETRIES` | `3` |
| `HOMOLOGATE_DEDUP_S` | `30` |
| `HOMOLOGATE_QUEUE_INTERVAL_S` | `5` |
| `HOMOLOGATE_UNIT` | `UNIT111` |
| `HOMOLOGATE_TZ` | `America/Lima` |


Se definen en `docker-compose.yml` (servicio `backend`). El código las lee en `backend/homologate.py` (`env_url`, `env_enabled`, `env_timeout`, `env_retries`).

Si `HOMOLOGATE_ENABLED` está apagado o `HOMOLOGATE_URL` queda vacío, el mensaje se guarda en Mongo y se marca `homologate_status: disabled`. No hay `POST`.

## Qué se envía

Solo entra una trama RX que no sea cabecera TCP y cuyo texto traiga al menos un JSON con `i`, `d01` (opcode `82A700`) y `d02` (opcode `82A701`). El armado está en `build_standard` (`backend/homologate.py`).

```json
{
  "i": "869387065279607", // en este caso 869387065279607 por la lectura de las tramas recurrentes 
  "d1": "<hex de d01, debe contener 82A700>",
  "d2": "<hex de d02, debe contener 82A701>",
  "d3": "1 32516 1051 0 0 0 0.0",
  "d4": "UNIT111"
}


HAY SECTORES DE LA INFROMACION QUE LLEGAN ASI EN ASCCII

21:14:07.645	RX 869387065279607{"i":"MAD000","d02";"1B0204000082A70100006608FCFF0304015C00FE7FFE7FFE7FFE7F0807060000FFFFFFFF3E2A1B04"}
21:14:08.647	RX 869387065279607{"i":"MAD000","d03";"1B0204000082A70200000000000000010001000000000000000000000000000100008ED11B04"}
21:14:09.843    RX 869387065279607{"i":"MAD000","d01";"1B0204000082A700D800FE7FBB00E40008010A01FF7F0301FE7FFE7FDC00E30046000000FE7FFE7FE3013C001100110010000300CC001E000000B7011B1B0400004100000026360000FE7FFE7FD800BB00FE7F00004200A800FE7FFF7FFE7FFE7F463E1B04"}
21:14:10.677	RX 869387065279607{"i":"MAD000","d05";"1B0204000082A7060000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF1D241B04"}
21:14:11.646	RX 869387065279607{"i":"MAD000","d04";"1B0204000082A7035A4752553435383838393037B11B04"}
21:14:17.777    RX 869387065279607{"i":"MAD000","rs":"PGet:21.5,21.6,18.7,0.0,0.0,22.0,22.7,92.0,70.0,2.6,0.3,119.5,150,40,2,0,0,255,0,0,0,10000,1000,0,90,2,3,0,40,90,15,3,2,3.0,1,0.0,0.0,0.0"}
21:14:19.637   RX  869387065279607PPM:912.3


normalmente  ocurre en un lapso de 20 segundos para ser considerado del mismo grupo .

y construir el json identificando "d1": "<hex de d01, debe contener 82A700>", y "d2": "<hex de d02, debe contener 82A701>", ahora "d3": "1 32516 1051 0 0 0 0.0", varia ya que d3 , se compone el ultimo elemnto el 0.0 varia segun la lectura obtenida de una extructura como esta 21:14:17.777    RX 869387065279607{"i":"MAD000","rs":"PGet:21.5,21.6,18.7,0.0,0.0,22.0,22.7,92.0,70.0,2.6,0.3,119.5,150,40,2,0,0,255,0,0,0,10000,1000,0,90,2,3,0,40,90,15,3,2,3.0,1,0.0,0.0,0.0"} , "PGet" como guia y en Get:21.5,21.6,18.7,0.0,0.0,22.0,22.7,92.0,70.0,2.6,0.3,119.5,150,40,2,0,0,255,0,0,0,10000,1000,0,90,2,3,0,40,90,15,3,2,3.0,1,0.0,0.0,0.0 identificamos el elemnto en al posicion de 119.5 , ahora ese elemnto se reemplaza  que en este caso seria "d3": "1 32516 1051 0 0 0 119.5", y asi sucesivamente en cada grupo de datos , "d4": "UNIT111" se mantiene y se construye el json valido con la estructura y se envia .

## Cómo se hace el POST

La función es `_post_standard` en `backend/main.py`:

1. `httpx.AsyncClient` con timeout `HOMOLOGATE_TIMEOUT_S`.
2. `POST` a `HOMOLOGATE_URL` con el JSON de arriba (`Content-Type: application/json`).
3. HTTP 2xx cuenta como éxito.
4. Cualquier otro código o excepción se reintenta hasta `HOMOLOGATE_RETRIES` veces, con espera `0.5 * intento` segundos.
5. Si se agotan los intentos, el resultado es error y el texto queda en el log (`http_<código>` o el mensaje de la excepción).

El `POST` corre en una tarea aparte, después de persistir el mensaje. No bloquea el socket `9912`

## Camino de cola (histórico)

El mismo `_post_standard` y el mismo link. La diferencia es el origen: no es la trama que acaba de entrar, sino mensajes ya guardados.

1. `GET /api/homologate/candidates` lista tramas homologables (filtro por `addr`, `ip`, `date`, `hour`).
2. `POST /api/homologate/enqueue` las mete en memoria y en `homologate_queue`. Rechaza con 400 si no hay URL.
3. `_homologate_queue_worker` saca una por una y espera `HOMOLOGATE_QUEUE_INTERVAL_S` (5 s) entre envíos.
4. El resultado se audita igual, con `source: "queue"`.

`POST /api/homologate/queue/clear` cancela lo que sigue en cola y aún no se está enviando.


Ahora existe una logica para elevar en numero 119.5 en caso se requiera y es enviara por el tx un string que tiene "RELE(1,N)_" donde n es el dato en segundos para inyectar gas , se calcula aproximadamente que si se pone N en 3 aumenta en 2  las lecturas es decir que si se aumenta RELE(1,3)_ y esta 119.5 se espara que suba a 121.5 o un poco mas . entonces se debe tener un panel de interfaz de control en donde se programe el nivel que se quiere alcanzar ejemplo 130 , y vaya enviando de forma proporcional un envio cada vez que esta a 2% menos del objetivo , ejemplo  si el objetivo es 130 , el control debe empezar actual al 2% que son 2.6 es decir cuando esta 130-2.6 osea 127.4 cuando este la lectura , ahora realizar un control PID en base a los datos ya que recolectamos datos cada cierto tiempo y podemos variar las dosis de acuerdo a las lecturas optenidas y dejando en contancia en el historico el porque el sistema esta hacinedo ese control y como parende a regular el sistema con la inyeccion y genera una funcion que una todo los procesos PID para mantener en equilibrio los niviles de lectura a ese objetivo