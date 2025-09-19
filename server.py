from flask import Flask, request, send_from_directory, abort, jsonify
from flask_cors import CORS
import os
import logging

app = Flask(__name__)
# Nếu deploy production, cân nhắc chỉ allow origins cần thiết
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_KEYS_PATH = os.path.join(BASE_DIR, "allowkeys.txt")

# White-list file names client có quyền tải
ALLOWED_FILES = {"ttc.js", "rd.js", "rmrd.js"}

# Logging cơ bản
logging.basicConfig(level=logging.INFO)

def load_allowed_keys():
    """Return list of tuples (finger, profile)"""
    if not os.path.exists(ALLOWED_KEYS_PATH):
        return []
    items = []
    with open(ALLOWED_KEYS_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            # expecting format base64finger|profile
            parts = line.split("|", 1)
            if len(parts) == 2:
                finger, profile = parts[0].strip(), parts[1].strip()
                items.append((finger, profile))
    return items

def is_valid_key(finger, profile):
    if not finger or not profile:
        return False
    allowed = load_allowed_keys()
    for saved_finger, saved_profile in allowed:
        if finger == saved_finger and profile == saved_profile:
            return True
    return False

@app.route("/")
def index():
    return "✅ Fonsida Server is running!"

@app.route("/<path:filename>")
def serve_file(filename):
    # 1) hạn chế file name bằng white-list
    if filename not in ALLOWED_FILES:
        logging.warning("File not allowed requested: %s from %s", filename, request.remote_addr)
        return "❌ File not allowed", 403

    # 2) đọc params theo client hiện tại: 'finger' và 'profile'
    finger = request.args.get("finger", default="", type=str)
    profile = request.args.get("profile", default="", type=str)

    # trim spaces (an toàn)
    finger = finger.strip()
    profile = profile.strip()

    # 3) verify
    if not is_valid_key(finger, profile):
        logging.info("Invalid access attempt: finger=%s profile=%s ip=%s", finger[:8]+"...", profile, request.remote_addr)
        return "❌ Sai key hoặc profile không hợp lệ", 403

    # 4) serve file from BASE_DIR (chỉ các file whitelisted)
    filepath = os.path.join(BASE_DIR, filename)
    if os.path.exists(filepath):
        # send_from_directory sẽ đảm bảo path safe trong directory
        return send_from_directory(BASE_DIR, filename)
    else:
        return "❌ File not found", 404

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    # debug=False khi deploy
    app.run(host="0.0.0.0", port=port, debug=False)
