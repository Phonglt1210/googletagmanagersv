from flask import Flask, request, abort, send_file
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

if os.path.exists("allowkeys.txt"):
    with open("allowkeys.txt", "r", encoding="utf-8") as f:
        allowed_keys = set(line.strip() for line in f if line.strip())
else:
    allowed_keys = set()
    print("⚠️ Không tìm thấy allowkeys.txt — sẽ từ chối tất cả key.")

@app.route("/")
def home():
    return "✅ Fonsida server đang hoạt động!"

@app.route("/tool.js")
def serve_tool():
    key = request.args.get("key", "")
    if key not in allowed_keys:
        abort(403)
    if not os.path.exists("tool_obfuscated.js"):
        return "❌ tool_obfuscated.js không tồn tại!", 500
    return send_file("tool_obfuscated.js", mimetype="application/javascript")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
