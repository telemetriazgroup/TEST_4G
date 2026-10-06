Tenemos esta secuencia 

16:52:57.933 HDR CONNECT 190.187.158.14:28753 → 9914
16:55:36.306 TX HEX HEX 161613ffffffff8457 ASCII ........W
16:55:37.348 RX HEX HEX 383639333837303635333334313838161693c003c003c003c013c60bc007c007c007c00be0030000db0d8c0eff1a091010370cfe00ff00ff00ffffffffffffffffffffffff000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000883 ASCII 869387065334188..................................7...................................................................
17:00:51.722 HDR DISCONNECT 190.187.158.14:28753


se le envia por TX en Hexadecimal por cada minuto 161613ffffffff8457

y se tiene como respuesta algo como esto en Hexadecimal 

3639333837303635333334313838161693c003c003c003c013c60bc007c007c007c00be0030000db0d8c0eff1a091010370cfe00ff00ff00ffffffffffffffffffffffff000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000883


se tiene que dividir en 2 sectores 

primer sector -> 3639333837303635333334313838 , comvertido a ASCII 869387065334188

segundo sector  -> 161693c003c003c003c013c60bc007c007c007c00be0030000db0d8c0eff1a091010370cfe00ff00ff00ffffffffffffffffffffffff000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000883


el segundo sector empieza con 161693

el primer sector tiene el imei en hexadecimal y se debe convertir a ASCII

ENTONCES se debe construir un JSON para enviar a un link de api por el metodo post que es :

http://161.132.53.51:9050/Starcool/

el json debe ser de esta estructura :


{
  i: el iemi , lo convertido del priemr sector 
  d01: 'METRO', esto es estatico 
  d02: lo que tenemos en el segundo sector,
}

en este ejemplo quedaria : 

{
  i: '869387065334188',
  d01: 'METRO',
  d02: '161693c003c003c003c013c60bc007c007c007c00be0030000db0d8c0eff1a091010370cfe00ff00ff00ffffffffffffffffffffffff000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000883',
}

entonces se debe crear un modulo donde se registro todo lo enviados con el i como referencia , ya que este puerto tendra varias session y a cada session le debe enviar el hexa 161613ffffffff8457 para sacar los datos trasformara en json y enviar al link y debemos registrar cada envio que se hace al link , ya que recibimos multiples sessiones en el puerto 9914 . 