#!/usr/bin/env python3
# server.py
"""
Fonsida file server with file-based expiry.
allowkeys.txt lines format:
    BASE64_FINGER|profile-name|expiry_epoch_seconds

If current time >= expiry => key is invalid.
"""

import os
import time
import logging
from typing import List, Tuple
from flask import Flask, request, send_from_directory, jsonify, make_response
from flask_cors import CORS

# ---------- Configuration ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_KEYS_PATH = os.path.join(BASE_DIR, "allowkeys.txt")

# Files that client is allowed to request
ALLOWED_FILES = set(os.environ.get("ALLOWED_FILES", "ttc.js,cut.js,ram.js,atjr.js,rd.js,rmrd.js").split(","))

# Rate limiting (per IP) - optional lightweight
MAX_REQ_PER_WINDOW = int(os.environ.get("MAX_REQ_PER_WINDOW", "120"))  # requests
WINDOW_SECONDS = int(os.environ.get("RATE_WINDOW_SECONDS", "60"))      # seconds

# CORS config: set to specific origins in production, default allows all for dev
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fonsida-server")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": CORS_ORIGINS}})

# In-memory rate limit store: ip -> (count, window_start)
_rate_store = {}

# ---------- Helpers ----------
def load_allowed_keys_with_exp() -> List[Tuple[str, str, int]]:
    """
    Read allowkeys.txt lines of form:
      BASE64FINGER|profile_name|expiry_epoch
    Lines starting with # or blank lines are ignored.
    Returns list of (finger, profile, expiry).
    """
    if not os.path.exists(ALLOWED_KEYS_PATH):
        return []
    out = []
    try:
        with open(ALLOWED_KEYS_PATH, "r", encoding="utf-8") as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("|")
                # allow lines with >=3 parts; extra parts joined into last if any
                if len(parts) < 3:
                    continue
                finger = parts[0].strip()
                profile = parts[1].strip()
                # expiry may include extra '|' if present; join remaining parts
                expiry_part = "|".join(parts[2:]).strip()
                try:
                    expiry = int(expiry_part)
                except:
                    expiry = 0
                out.append((finger, profile, expiry))
    except Exception as e:
        logger.exception("Failed to load allowkeys.txt: %s", e)
    return out

def is_valid_key(finger: str, profile: str) -> bool:
    """
    Validate that (finger, profile) exists and current time < expiry.
    """
    if not finger or not profile:
        return False
    now = int(time.time())
    allowed = load_allowed_keys_with_exp()
    for saved_finger, saved_profile, expiry in allowed:
        if saved_profile != profile:
            continue
        # exact match for stored base64
        if finger == saved_finger:
            if expiry > now:
                return True
            else:
                # expired
                return False
    return False

def check_rate_limit(client_ip: str) -> bool:
    """Return True if allowed, False if rate limited."""
    now = int(time.time())
    entry = _rate_store.get(client_ip)
    if entry is None:
        _rate_store[client_ip] = [1, now]  # count, window_start
        return True
    count, window_start = entry
    if now - window_start >= WINDOW_SECONDS:
        # reset window
        _rate_store[client_ip] = [1, now]
        return True
    else:
        if count + 1 > MAX_REQ_PER_WINDOW:
            return False
        else:
            _rate_store[client_ip][0] = count + 1
            return True

def _prune_rate_store():
    now = int(time.time())
    keys = list(_rate_store.keys())
    for k in keys:
        _, w = _rate_store[k]
        if now - w > (WINDOW_SECONDS * 3):
            _rate_store.pop(k, None)

# ---------- Routes ----------
@app.route("/", methods=["GET"])
def index():
    return "✅ Fonsida Server is running!"

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": int(time.time())})

@app.route("/<path:filename>", methods=["GET"])
def serve_file(filename):
    # light prune occasionally
    try:
        _prune_rate_store()
    except Exception:
        pass

    client_ip = request.remote_addr or "unknown"
    if not check_rate_limit(client_ip):
        logger.warning("Rate limit exceeded from IP=%s", client_ip)
        return "❌ Too many requests", 429

    # Only allow specific files
    if filename not in ALLOWED_FILES:
        logger.warning("Denied file request (not whitelisted) filename=%s ip=%s", filename, client_ip)
        return "❌ File not allowed", 403

    # Accept 'finger' (preferred) or legacy 'key'
    finger = request.args.get("finger") or request.args.get("key")
    profile = request.args.get("profile")

    if not finger or not profile:
        logger.info("Missing params for request from ip=%s filename=%s finger=%s profile=%s",
                    client_ip, filename, str(finger)[:16] + ("..." if finger and len(finger) > 16 else ""), profile)
        return "❌ Missing fingerprint or profile", 400

    finger = finger.strip()
    profile = profile.strip()

    # Validate using allowkeys.txt with expiry
    if not is_valid_key(finger, profile):
        logger.info("Invalid or expired access attempt ip=%s filename=%s finger=%s profile=%s",
                    client_ip, filename, (finger[:12] + "...") if len(finger) > 12 else finger, profile)
        return "❌ Sai key hoặc profile không hợp lệ hoặc đã hết hạn", 403

    # Serve file and attach cache-control headers to avoid caching
    filepath = os.path.join(BASE_DIR, filename)
    if os.path.exists(filepath):
        logger.info("Serving file=%s to ip=%s profile=%s", filename, client_ip, profile)
        resp = make_response(send_from_directory(BASE_DIR, filename))
        # Prevent caching by browsers/CDNs (adjust if you use CDN)
        resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        resp.headers['Pragma'] = 'no-cache'
        resp.headers['Expires'] = '0'
        return resp
    else:
        logger.warning("File not found: %s requested by ip=%s", filename, client_ip)
        return "❌ File not found", 404

# ---------- Run ----------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    logger.info("Starting Fonsida server on 0.0.0.0:%s", port)
    app.run(host="0.0.0.0", port=port, debug=False)
