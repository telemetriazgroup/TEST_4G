

ahora tenemos tramas que llegan de esta forma 
{"i":"POLLO_BEBE","rs":"RELAY001_DATA:1 0 1 1 1 1 1 1 0 0 ,10.1,9.9,10.0,10.2,80.0,95.0"}
 esta ultima trama se actualizo en la imagen veras que hay dos  datos mas que estan al ultimo que es la Humedad relativa y el  setpoint de humedad respectivamente 

 aparte los relay tienen un nombre , que pueden ser editados pero que de froma predefinida sera "libre"

 en este caso

 RELAY1     ->libre
 RELAY2     ->libre
 RELAY3     ->renovacion de aire off
 RELAY4     ->renovacion de aire on
 RELAY5     ->Act on bypass
 RELAY6     ->Act off inferior /salida de gases  off
 RELAY7     ->Act on inferior /salida de gases   on
 RELAY8     ->Act off bypass
 RELAY9     ->Aire
 RELAY10    ->Agua



y esta forma :
ASCII {"i":"POLLO_BEBE","rs":"INFO:24.1,23.3,22.0,23.0,22.8,22.8,22.8,0.1,80.0,12.5,95.0"}
 esta ultima trama se actualizo en la imagen veras que hay un dato mas que esta al ultimo que es el setpoint de humedad 


la idea es guardar esta infromacion ya que la trama INFO es lo que vee en la pantalla en local , RELAY001_DATA es el estado de los sitemas de control , todo estos se crean como nuevos json apartes que serviran para luego asimilar la telemtria 





