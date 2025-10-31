#!/usr/bin/env python3
# server.py
"""
Simple Fonsida file server (no-expiry)
- allowkeys.txt lines: BASE64_FINGER|profile
- Whitelisted files are hard-coded in ALLOWED_FILES
- Accepts query params: ?finger=<base64>&profile=<profile>
- Fallback: profile from header X-Profile or cookie ziga_profile
"""

import os
import time
import logging
from typing import List, Tuple, Optional
from flask import Flask, request, send_from_directory, make_response, jsonify
from flask_cors import CORS

# ---------- Configuration ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_KEYS_PATH = os.path.join(BASE_DIR, "allowkeys.txt")

# hard-coded whitelist of files (from user's Tampermonkey)
ALLOWED_FILES = {"ttc.js", "rd.js", "atjr.js", "rmrd.js", "ard.js"}

# rate limiting simple per-ip
MAX_REQ_PER_WINDOW = int(os.environ.get("MAX_REQ_PER_WINDOW", "180"))  # requests
WINDOW_SECONDS = int(os.environ.get("RATE_WINDOW_SECONDS", "60"))     # seconds

# CORS origin (adjust in production)
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

# optional admin secret to allow safe admin endpoints (if set in env)
ADMIN_SECRET = os.environ.get("ADMIN_SECRET")

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fonsida-noexpiry")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": CORS_ORIGINS}})

_rate_store = {}  # ip -> [count, window_start]

# ---------- Helpers ----------
def _now() -> int:
    return int(time.time())

def _prune_rate_store():
    now = _now()
    for k in list(_rate_store.keys()):
        _, w = _rate_store[k]
        if now - w > (WINDOW_SECONDS * 3):
            _rate_store.pop(k, None)

def check_rate_limit(client_ip: str) -> bool:
    now = _now()
    ent = _rate_store.get(client_ip)
    if ent is None:
        _rate_store[client_ip] = [1, now]
        return True
    count, start = ent
    if now - start >= WINDOW_SECONDS:
        _rate_store[client_ip] = [1, now]
        return True
    if count + 1 > MAX_REQ_PER_WINDOW:
        return False
    _rate_store[client_ip][0] = count + 1
    return True

def normalize(s: Optional[str]) -> str:
    return (s or "").strip()

def b64_variants(s: str) -> List[str]:
    """Return padded and unpadded variants for tolerant compare."""
    s0 = normalize(s)
    s1 = s0.rstrip("=")
    if s1 == s0:
        return [s0]
    return [s0, s1]

def load_allowed_keys() -> List[Tuple[str, str]]:
    """
    Read allowkeys.txt and return list of (finger_base64, profile).
    Lines with fewer than 2 parts are ignored. Ignore blank or lines starting with '#'.
    """
    out: List[Tuple[str, str]] = []
    if not os.path.exists(ALLOWED_KEYS_PATH):
        return out
    try:
        with open(ALLOWED_KEYS_PATH, "r", encoding="utf-8") as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("|")
                if len(parts) < 2:
                    continue
                finger = parts[0].strip()
                profile = parts[1].strip()
                if finger and profile:
                    out.append((finger, profile))
    except Exception as e:
        logger.exception("Failed to read allowkeys.txt: %s", e)
    return out

def is_valid_key(finger: str, profile: str) -> bool:
    """
    Validate given (finger, profile) against allowkeys.txt.
    No expiry logic: any matching entry => valid.
    Tolerant to base64 padding differences.
    """
    if not finger or not profile:
        return False
    allowed = load_allowed_keys()
    if not allowed:
        logger.debug("allowkeys.txt empty or missing")
        return False

    req_vars = set(b64_variants(finger))
    for saved_f, saved_p in allowed:
        if saved_p != profile:
            continue
        saved_vars = set(b64_variants(saved_f))
        if req_vars & saved_vars:
            logger.info("Valid key matched profile=%s", profile)
            return True
    return False

# ---------- Routes ----------
@app.route("/", methods=["GET"])
def index():
    return "✅ Fonsida Server (no-expiry) running"

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": _now()})

@app.route("/<path:filename>", methods=["GET"])
def serve_file(filename):
    try:
        _prune_rate_store()
    except Exception:
        pass

    client_ip = request.remote_addr or "unknown"
    if not check_rate_limit(client_ip):
        logger.warning("Rate limit exceeded from IP=%s", client_ip)
        return "❌ Too many requests", 429

    # whitelist check
    if filename not in ALLOWED_FILES:
        logger.warning("Denied file request (not whitelisted) filename=%s ip=%s", filename, client_ip)
        return "❌ File not allowed", 403

    # prefer 'finger' param (user Tampermonkey uses finger)
    finger = request.args.get("finger") or request.args.get("key")
    profile = request.args.get("profile")
    # fallback to header/cookie to help race conditions on client-side
    if not profile:
        profile = request.headers.get("X-Profile") or request.cookies.get("ziga_profile")

    short_f = (finger[:16] + "...") if finger and len(finger) > 16 else (finger or "<NONE>")
    logger.debug("Incoming: file=%s ip=%s finger=%s profile=%s args=%s", filename, client_ip, short_f, profile, dict(request.args))

    if not finger or not profile:
        logger.info("Missing params for request from ip=%s filename=%s finger=%s profile=%s",
                    client_ip, filename, short_f, profile)
        return "❌ Missing fingerprint or profile", 400

    finger = normalize(finger)
    profile = normalize(profile)

    # validate
    if not is_valid_key(finger, profile):
        logger.info("Invalid access attempt ip=%s filename=%s finger=%s profile=%s",
                    client_ip, filename, (finger[:12] + "...") if len(finger) > 12 else finger, profile)
        return "❌ Sai key hoặc profile không hợp lệ", 403

    # serve file (from BASE_DIR)
    filepath = os.path.join(BASE_DIR, filename)
    if os.path.exists(filepath):
        logger.info("Serving file=%s to ip=%s profile=%s", filename, client_ip, profile)
        resp = make_response(send_from_directory(BASE_DIR, filename))
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        return resp
    else:
        logger.warning("File not found: %s requested by ip=%s", filename, client_ip)
        return "❌ File not found", 404

# ---------- Optional admin endpoints (protected by ADMIN_SECRET if set) ----------
def _require_admin():
    if not ADMIN_SECRET:
        return False
    token = request.headers.get("X-Admin-Secret") or request.args.get("admin_secret")
    return bool(token and token == ADMIN_SECRET)

@app.route("/admin/list", methods=["GET"])
def admin_list():
    if not _require_admin():
        return "unauthorized", 401
    allowed = load_allowed_keys()
    return jsonify({"count": len(allowed), "keys": [{"finger": f, "profile": p} for f, p in allowed]})

@app.route("/admin/add", methods=["POST"])
def admin_add():
    if not _require_admin():
        return "unauthorized", 401
    data = request.get_json() or {}
    finger = data.get("finger")
    profile = data.get("profile")
    if not finger or not profile:
        return jsonify({"error": "finger & profile required"}), 400
    # append to file
    line = f"{finger.strip()}|{profile.strip()}"
    with open(ALLOWED_KEYS_PATH, "a", encoding="utf-8") as fh:
        fh.write(line.rstrip() + "\n")
    logger.info("Admin: appended allowkey for profile=%s", profile)
    return jsonify({"ok": True})

@app.route("/admin/remove", methods=["POST"])
def admin_remove():
    if not _require_admin():
        return "unauthorized", 401
    data = request.get_json() or {}
    finger = data.get("finger")
    profile = data.get("profile")
    if not finger and not profile:
        return jsonify({"error": "finger or profile required"}), 400
    # remove matching lines
    removed = 0
    if os.path.exists(ALLOWED_KEYS_PATH):
        kept = []
        with open(ALLOWED_KEYS_PATH, "r", encoding="utf-8") as fh:
            for raw in fh:
                line = raw.rstrip("\n")
                if not line.strip() or line.strip().startswith("#"):
                    kept.append(line)
                    continue
                parts = line.split("|")
                if len(parts) < 2:
                    kept.append(line)
                    continue
                lf = parts[0].strip()
                lp = parts[1].strip()
                match = True
                if finger:
                    if lf not in b64_variants(finger) and lf.rstrip("=") not in b64_variants(finger):
                        match = False
                if profile and profile != lp:
                    match = False
                if match:
                    removed += 1
                else:
                    kept.append(line)
        with open(ALLOWED_KEYS_PATH + ".tmp", "w", encoding="utf-8") as fh:
            fh.write("\n".join(kept).rstrip("\n") + "\n")
        os.replace(ALLOWED_KEYS_PATH + ".tmp", ALLOWED_KEYS_PATH)
    logger.info("Admin: removed %d entries (finger=%s profile=%s)", removed, finger, profile)
    return jsonify({"removed": removed})

# ---------- Run ----------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    logger.info("Starting Fonsida no-expiry server on 0.0.0.0:%s", port)
    app.run(host="0.0.0.0", port=port, debug=False)
