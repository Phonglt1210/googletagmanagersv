from flask import Flask, send_from_directory
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)  # ✅ Cho phép tất cả các origin truy cập (bao gồm zigavn.com)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.route("/")
def index():
    return "✅ Fonsida Server is running!"

@app.route("/<path:filename>")
def serve_file(filename):
    filepath = os.path.join(BASE_DIR, filename)
    if os.path.exists(filepath):
        return send_from_directory(BASE_DIR, filename)
    else:
        return "❌ File not found", 404

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
