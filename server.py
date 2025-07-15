from flask import Flask, request, abort, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Đọc danh sách key được phép
try:
    with open('allowkeys.txt', 'r', encoding='utf-8') as f:
        allowed_keys = set(line.strip() for line in f if line.strip())
except Exception as e:
    print(f"Lỗi đọc allowkeys.txt: {e}")
    allowed_keys = set()

@app.route("/tool.js")
def get_tool():
    key = request.args.get("key", "")
    if key not in allowed_keys:
        abort(403)
    try:
        return send_file("tool_obfuscated.js", mimetype="application/javascript")
    except Exception as e:
        return f"⚠️ Lỗi khi tải tool: {e}", 500

@app.route("/")
def home():
    return "✅ Fonsida Server đang hoạt động!"
