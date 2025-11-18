import azure.functions as func
import json
import logging

# Inicializamos la app
app = func.FunctionApp()

# -------------------------------------------------
# 1. INSERTAR DATOS (POST)
# -------------------------------------------------
@app.route(route="ingestApi", auth_level=func.AuthLevel.ANONYMOUS)      #la ruta final sera: .../api/route
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
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(e)
        return func.HttpResponse(f"Error: {str(e)}", status_code=500)

# -------------------------------------------------
# 2. LEER DATOS (GET)
# -------------------------------------------------
@app.route(route="obtainData", auth_level=func.AuthLevel.ANONYMOUS)
@app.sql_input(arg_name="listaEmpleados",                               #aqui se almacenan todas las filas obtenidas de la base de datos (func.SqlRowList)
               command_text="SELECT * FROM [dbo].[device_payloads]",
               command_type="Text",
               connection_string_setting="SqlConnectionString")
def ObtenerEmpleados(req: func.HttpRequest, listaEmpleados: func.SqlRowList) -> func.HttpResponse:
    logging.info('Leyendo BD...')

    # Convertimos la respuesta de SQL (que viene en objetos raros) a JSON normal
    resultados = [json.loads(row.to_json()) for row in listaEmpleados]  #a aprtir de los datos en formato raro que nos devuelve la BD creamos un dict de python

    return func.HttpResponse(
        json.dumps(resultados),
        status_code=200,
        mimetype="application/json"
    )