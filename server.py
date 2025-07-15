from flask import Flask, request, abort, send_file
from flask_cors import CORS  # <== THÊM DÒNG NÀY

app = Flask(__name__)
CORS(app)  # <== BẬT CORS TOÀN BỘ APP

with open('allowkeys.txt', 'r', encoding='utf-8') as f:
    allowed_keys = set(line.strip() for line in f if line.strip())

@app.route("/tool.js")
def get_tool():
    key = request.args.get("key", "")
    if key not in allowed_keys:
        abort(403)
    return send_file("tool_obfuscated.js", mimetype="application/javascript")

@app.route("/")
def home():
    return "✅ Fonsida Server đang hoạt động!"
