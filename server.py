from flask import Flask, request, abort, send_file
import os

app = Flask(__name__)

KEY_FILE = 'allowkeys.txt'
TOOL_FILE = 'tool_obfuscated.js'

@app.route('/')
def home():
    return '✅ Server is running.'

@app.route('/tool.js')
def serve_tool():
    key = request.args.get('key', '')

    if not os.path.exists(KEY_FILE):
        return '❌ Server config error: Key file missing.', 500

    with open(KEY_FILE, 'r') as f:
        valid_keys = [line.strip() for line in f.readlines() if line.strip()]

    if key not in valid_keys:
        return '❌ Invalid or missing key.', 403

    if not os.path.exists(TOOL_FILE):
        return '❌ Tool not found.', 500

    return send_file(TOOL_FILE, mimetype='application/javascript')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
