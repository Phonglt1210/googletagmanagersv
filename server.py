from flask import Flask, request, send_from_directory
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_KEYS_PATH = os.path.join(BASE_DIR, "allowkeys.txt")

def is_valid(key, finger, profile):
    if not os.path.exists(ALLOWED_KEYS_PATH):
        return False
    with open(ALLOWED_KEYS_PATH, "r") as f:
        allowed = [line.strip().split("|") for line in f if line.strip()]
        for entry in allowed:
            if len(entry) == 3:
                k, fgr, prf = entry
                if k == key and fgr == finger and prf == profile:
                    return True
    return False

@app.route("/")
def index():
    return "✅ Fonsida Server is running!"

@app.route("/<path:filename>")
def serve_file(filename):
    key = request.args.get("key")
    finger = request.args.get("finger")
    profile = request.args.get("profile")

    if not key or not finger or not profile:
        return "❌ Thiếu tham số key/finger/profile", 400

    if not is_valid(key, finger, profile):
        return "❌ Key, finger hoặc profile không hợp lệ", 403

    filepath = os.path.join(BASE_DIR, filename)
    if os.path.exists(filepath):
        return send_from_directory(BASE_DIR, filename)
    else:
        return "❌ File not found", 404

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
