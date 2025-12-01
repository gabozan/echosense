from flask import Flask, render_template

# Inicializamos la aplicación Flask
app = Flask(__name__)

# Definimos la ruta principal (Home)
@app.route('/')
def home():
    # Flask buscará automáticamente este archivo en la carpeta "templates"
    return render_template('index.html')

if __name__ == '__main__':
    # Esto permite correrlo en local, pero en Azure Gunicorn se encargará
    app.run(debug=True)