import azure.functions as func
import json
import logging
import time
import random


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "http://localhost:3000",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
}


# Inicializamos la app
app = func.FunctionApp()

# -------------------------------------------------
#INSERTAR DATOS DESDE UN NODO (POST)
@app.route(route="ingestData", auth_level=func.AuthLevel.ANONYMOUS)      #la ruta final sera: .../api/route
@app.sql_output(arg_name="salidaDb",                                    #esto con lo que insertaremos los datos en la BD (func.Out[func.SqlRow])
                command_text="[dbo].[device_payloads]",                 #esto es la tabla donde vamos a insertar datos
                connection_string_setting="SqlConnectionString")        
def CrearEmpleado(req: func.HttpRequest, salidaDb: func.Out[func.SqlRow]) -> func.HttpResponse:
    logging.info('Insertando lecturas en la BD...')

    try:
        # Convertimos el cuerpo de la petición (JSON) a un diccionario
        cuerpo = req.get_json()
        
        # Creamos la fila para SQL. Las claves deben coincidir con tus columnas de la DB
        nueva_fila = func.SqlRow({
            "id": cuerpo.get("id"),
            "laeq": cuerpo.get("laeq"),
            "peak": cuerpo.get("peak"),
            "class": cuerpo.get("class"),
            "status": cuerpo.get("status"),
            "timestamp": cuerpo.get("timestamp")
        })

        # ¡Magia! Esto inserta en la base de datos sin escribir INSERT INTO
        salidaDb.set(nueva_fila)

        return func.HttpResponse(
            json.dumps({"mensaje": "La lectura ha sido guardada con éxito!"}),
            status_code=201,
            mimetype="application/json",
            headers=CORS_HEADERS
        )
    except Exception as e:
        logging.error(e)
        return func.HttpResponse(f"Error: {str(e)}", status_code=500)
    

#-----------------------------------------------
#REGISTRAR NODO (POST)
@app.route(route="nodeRegistration", auth_level=func.AuthLevel.ANONYMOUS)
@app.sql_output(arg_name="salidaDb",     
                command_text="[dbo].[node_metadata]",   
                connection_string_setting="SqlConnectionString")
def nodeRegistration(req: func.HttpRequest, salidaDb: func.Out[func.SqlRow]) -> func.HttpResponse:
    logging.info('Registrando nodo en la BD...')

    try:
        cuerpo = req.get_json()
        
        nueva_fila = func.SqlRow({
            "id": cuerpo.get("id"),
            "lat": cuerpo.get("lat"),
            "lon": cuerpo.get("lon"),
            "battery": cuerpo.get("battery")
        })

        salidaDb.set(nueva_fila)

        return func.HttpResponse(
            json.dumps({"mensaje": "El nodo se ha registrado con éxito!"}),
            status_code=201,
            mimetype="application/json",
            headers=CORS_HEADERS
        )
    except Exception as e:
        logging.error(e)
        return func.HttpResponse(f"Error: {str(e)}", status_code=500)

# -------------------------------------------------
#LEER DATOS de la BD [TODOS LOS DE LA TABLA DE PAYLOADS] raw (GET)
@app.route(route="obtainRawData", auth_level=func.AuthLevel.ANONYMOUS)
@app.sql_input(arg_name="datos",                               #aqui se almacenan todas las filas obtenidas de la base de datos (func.SqlRowList)
               command_text="SELECT * FROM [dbo].[device_payloads]",
               command_type="Text",
               connection_string_setting="SqlConnectionString")
def obtainRawData(req: func.HttpRequest, datos: func.SqlRowList) -> func.HttpResponse:
    logging.info('Leyendo BD...')

    # Convertimos la respuesta de SQL (que viene en objetos raros) a JSON normal
    resultados = [json.loads(row.to_json()) for row in datos]  #a aprtir de los datos en formato raro que nos devuelve la BD creamos un dict de python

    return func.HttpResponse(
        json.dumps(resultados),
        status_code=200,
        mimetype="application/json",
        headers=CORS_HEADERS
    )



# -------------------------------------------------
#LEER DATOS de la BD (GET)
@app.route(route="obtainData", auth_level=func.AuthLevel.ANONYMOUS)
@app.sql_input(arg_name="payloads",                   
               command_text="SELECT * FROM (SELECT *, ROW_NUMBER() OVER(PARTITION BY id ORDER BY timestamp DESC) AS rn FROM [dbo].[device_payloads]) x WHERE rn = 1;",
               command_type="Text",
               connection_string_setting="SqlConnectionString")
@app.sql_input(arg_name="metadata",                 
               command_text="SELECT * FROM [dbo].[node_metadata]",
               command_type="Text",
               connection_string_setting="SqlConnectionString")
def obtainData(req: func.HttpRequest, payloads: func.SqlRowList, metadata: func.SqlRowList) -> func.HttpResponse:
    logging.info('Leyendo BD...')

    payloads_results = [json.loads(row.to_json()) for row in payloads] 
    metadata_results = [json.loads(row.to_json()) for row in metadata]

    #TODO: hacer la logica para hacer el enrichment
    resultados = []
    for node in metadata_results:
        logging.info('debug--------')
        logging.info(len(metadata_results))
        node_data = next((d for d in payloads_results if d['id'] == node['id']), None)
        if node_data is not None:
            node_result = {
                'id': node['id'],
                'lat': node['lat'],
                'lon': node['lon'],
                'laeq': node_data['laeq'],
                'peak': node_data['peak'],
                'class': node_data['class'],
                'battery': node['battery'],
                'status': node_data['status'],
                'timestamp': node_data['timestamp']
            }
        else:
            simulated_laeq = round(random.uniform(30.0, 65.0), 2)
            node_result = {
                'id': node['id'],
                'lat': node['lat'],
                'lon': node['lon'],
                'laeq': simulated_laeq,
                'peak': round(simulated_laeq + random.uniform(5.0, 20.0), 2),
                'class': random.choice(['silence', 'traffic', 'voices', 'music', 'machinery']),
                'battery': node['battery'],
                'status': random.choice(['active']),
                'timestamp': int(time.time())
            }
        resultados.append(node_result)
        
    return func.HttpResponse(
        json.dumps(resultados),
        status_code=200,
        mimetype="application/json",
        headers=CORS_HEADERS
    )