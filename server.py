from flask import Flask, request, abort, send_file
import hashlib

app = Flask(__name__)

def generate_key():
    ua = request.headers.get('User-Agent', '')
    lang = request.headers.get('Accept-Language', '')
    raw = ua + lang
    return hashlib.md5(raw.encode()).hexdigest()

@app.route("/tool.js")
def serve_tool():
    key = request.args.get("key", "").strip()
    if not key:
        abort(403)
    with open("allowed_keys.txt") as f:
        allowed = f.read().splitlines()
    if key not in allowed:
        abort(403)
    return send_file("tool_obfuscated.js", mimetype="application/javascript")

@app.route("/")
def home():
    return "✅ Fonsida Server đang chạy."

