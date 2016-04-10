from data import data
from flask import Flask, send_from_directory

app = Flask(__name__, static_url_path='/static')
app.register_blueprint(data)


@app.route('/')
def root():
    return app.send_static_file('index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    app.run()
