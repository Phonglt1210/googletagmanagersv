from flask import Flask, request, send_from_directory
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_KEYS_PATH = os.path.join(BASE_DIR, "allowkeys.txt")

def is_valid_key(finger, profile):
    if not os.path.exists(ALLOWED_KEYS_PATH):
        return False
    with open(ALLOWED_KEYS_PATH, "r") as f:
        allowed = [line.strip() for line in f if line.strip()]
        for entry in allowed:
            try:
                saved_finger, saved_profile = entry.split("|", 1)
                if finger == saved_finger and profile == saved_profile:
                    return True
            except ValueError:
                continue
    return False

@app.route("/")
def index():
    return "✅ Fonsida Server is running!"

@app.route("/<path:filename>")
def serve_file(filename):
    finger = request.args.get("key")       # key = fingerprint
    profile = request.args.get("profile")  # thêm profile

    if not finger or not profile or not is_valid_key(finger, profile):
        return "❌ Sai key hoặc profile không hợp lệ", 403

    filepath = os.path.join(BASE_DIR, filename)
    if os.path.exists(filepath):
        return send_from_directory(BASE_DIR, filename)
    else:
        return "❌ File not found", 404

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
