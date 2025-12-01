from flask import Flask, render_template

# Configuración crucial:
# 1. static_url_path='': Esto permite pedir archivos como '/style.css' en lugar de '/static/style.css'
# 2. static_folder='templates': Le dice a Flask que busque los archivos estáticos (css, img, js) en 'templates'
# 3. template_folder='templates': Le dice a Flask que busque los HTML en 'templates' (comportamiento normal)

app = Flask(__name__, 
            static_url_path='', 
            static_folder='templates', 
            template_folder='templates')

@app.route('/')
def home():
    # Asegúrate de tener un archivo llamado 'index.html' en tu carpeta templates
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)