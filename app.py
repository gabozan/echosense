from flask import Flask, send_from_directory
import os

# Configuración:
# static_folder='templates': Busca los archivos estáticos (js, css, imágenes) aquí.
# static_url_path='': Permite pedirlos desde la raíz (ej: /logo192.png o /static/js/main.js).
app = Flask(__name__, static_folder='templates', static_url_path='')

@app.route('/')
def serve_index():
    # Usamos send_from_directory en lugar de render_template para evitar
    # conflictos con la sintaxis de llaves {{ }} de React/JS.
    return send_from_directory('templates', 'index.html')

# Esta ruta es opcional pero recomendada para "Single Page Apps" (React/Vue):
# Si recargas la página en una ruta interna (ej: /perfil), esto evita el error 404
# y devuelve el index.html para que el frontend maneje la ruta.
@app.errorhandler(404)
def not_found(e):
    if os.path.exists('templates/index.html'):
        return send_from_directory('templates', 'index.html')
    return e

if __name__ == '__main__':
    app.run(debug=True, port=5000)