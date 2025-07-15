from flask import Flask, request, Response
import os

app = Flask(__name__)

# Load key từ file
with open('allowkeys.txt', 'r', encoding='utf-8') as f:
    allowed_keys = set(line.strip() for line in f if line.strip())

@app.route("/")
def home():
    return "✅ Fonsida Server Running"

@app.route("/tool.js")
def serve_tool():
    key = request.args.get('key', '').strip()
    if key not in allowed_keys:
        return Response("Forbidden: Invalid key", status=403)

    if os.path.exists("tool_obfuscated.js"):
        with open("tool_obfuscated.js", "r", encoding="utf-8") as f:
            return Response(f.read(), mimetype="application/javascript")
    return Response("File not found", status=404)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
