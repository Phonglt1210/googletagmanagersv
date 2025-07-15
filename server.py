from flask import Flask, request, abort
import os

app = Flask(__name__)

# Danh sách key hợp lệ (ví dụ thôi, bạn có thể load từ file/text khác)
ALLOWED_KEYS = {"some_key_1", "some_key_2"}

@app.route("/tool.js")
def serve_tool():
    key = request.args.get("key", "")
    if key not in ALLOWED_KEYS:
        abort(403, "Invalid key")

    with open("tool_obfuscated.js", "r", encoding="utf-8") as f:
        return f.read(), 200, {"Content-Type": "application/javascript"}

@app.route("/")
def home():
    return "Fonsida Server đang chạy!"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
