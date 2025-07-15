from flask import Flask, request, Response
import base64
import os

app = Flask(__name__)

# Tải danh sách key từ file allowkey.txt
def load_allowed_keys():
    try:
        with open("allowkey.txt", "r") as f:
            return [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        return []

ALLOWED_KEYS = load_allowed_keys()

@app.route("/")
def index():
    return "✅ Fonsida Server đang hoạt động."

@app.route("/tool.js")
def get_tool():
    key = request.args.get("key", "")
    if key not in ALLOWED_KEYS:
        return Response("❌ Forbidden: Invalid key", status=403)

    if not os.path.exists("tool_obfuscated.js"):
        return Response("❌ tool_obfuscated.js not found", status=500)

    with open("tool_obfuscated.js", "r", encoding="utf-8") as f:
        code = f.read()
    return Response(code, mimetype="application/javascript")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
