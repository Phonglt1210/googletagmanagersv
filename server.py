#!/usr/bin/env python3
# server.py
"""
Simple Fonsida file server WITHOUT expiry.
allowkeys.txt accepted lines:
  BASE64_FINGER|profile
  (or BASE64_FINGER|profile|anything) -- anything after 2nd '|' is ignored.
Matching: if any line has matching base64 finger (tolerant to padding) and profile (exact string),
then request is allowed.

Environment variables:
  PORT            - port to listen on (default 5000)
  ALLOWED_FILES   - comma separated allowed files (default: ttc.js,cut.js,ram.js,atjr.js,rd.js,rmrd.js)
  MAX_REQ_PER_WINDOW - rate limit count per WINDOW_SECONDS (default 120)
  RATE_WINDOW_SECONDS - rate window in seconds (default 60)
  CORS_ORIGINS    - CORS origins, default '*'
  ADMIN_SECRET    - if set, enables /admin endpoints protected by this secret
"""

import os
import time
import logging
from typing import List, Tuple, Optional
from flask import Flask, request, send_from_directory, jsonify, make_response, abort
from flask_cors import CORS

# ---------- Config ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_KEYS_PATH = os.path.join(BASE_DIR, "allowkeys.txt")

ALLOWED_FILES = set(x.strip() for x in os.environ.get("ALLOWED_FILES", "ttc.js,cut.js,ram.js,atjr.js,rd.js,rmrd.js").split(",") if x.strip())

MAX_REQ_PER_WINDOW = int(os.environ.get("MAX_REQ_PER_WINDOW", "120"))
WINDOW_SECONDS = int(os.environ.get("RATE_WINDOW_SECONDS", "60"))
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
ADMIN_SECRET = os.environ.get("ADMIN_SECRET")  # optional admin protection

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fonsida-server")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": CORS_ORIGINS}})

_rate_store = {}  # simple ip -> [count, window_start]

# ---------- Helpers ----------
def _now() -> int:
    return int(time.time())

def normalize_b64(s: str) -> str:
    return (s or "").strip()

def b64_variants(s: str) -> List[str]:
    """
    Return base64 variants to compare: padded and no-pad.
    """
    s0 = normalize_b64(s)
    s1 = s0.rstrip("=")
    if s1 == s0:
        return [s0]
    return [s0, s1]

def load_allowed_keys() -> List[Tuple[str, str]]:
    """
    Load allowkeys.txt lines. Accept lines with at least 2 parts: base64|profile.
    Ignore blank lines and lines starting with #.
    If more parts present, they are ignored.
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
    Validate (finger, profile) against allowkeys.txt.
    Expiry is NOT used here; any matching entry -> valid.
    Base64 comparison tolerant to padding.
    """
    if not finger or not profile:
        return False
    allowed = load_allowed_keys()
    if not allowed:
        logger.debug("No allowed keys loaded")
        return False

    req_vars = set(b64_variants(finger))
    matched_any = False
    for saved_f, saved_p in allowed:
        if saved_p != profile:
            continue
        saved_vars = set(b64_variants(saved_f))
        if req_vars & saved_vars:
            logger.info("Matched allowed key for profile=%s", profile)
            return True
    return False

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

def _prune_rate_store():
    now = _now()
    for k in list(_rate_store.keys()):
        _, w = _rate_store[k]
        if now - w > (WINDOW_SECONDS * 3):
            _rate_store.pop(k, None)

# ---------- Admin helpers ----------
def _require_admin():
    if not ADMIN_SECRET:
        abort(404)
    token = request.headers.get("X-Admin-Secret") or request.args.get("admin_secret")
    if not token or token != ADMIN_SECRET:
        abort(401)

def admin_add_key(finger: str, profile: str) -> None:
    # append a line with empty expiry (we ignore expiry anyway)
    line = f"{finger}|{profile}"
    with open(ALLOWED_KEYS_PATH, "a", encoding="utf-8") as fh:
        fh.write(line.rstrip() + "\n")
    logger.info("Admin: appended allowkey for profile=%s", profile)

def admin_remove_key(finger: Optional[str]=None, profile: Optional[str]=None) -> int:
    if not os.path.exists(ALLOWED_KEYS_PATH):
        return 0
    kept = []
    removed = 0
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
                # tolerant compare
                if lf not in b64_variants(finger) and lf.rstrip("=") not in b64_variants(finger):
                    match = False
            if profile and profile != lp:
                match = False
            if match:
                removed += 1
                continue
            kept.append(line)
    with open(ALLOWED_KEYS_PATH + ".tmp", "w", encoding="utf-8") as fh:
        fh.write("\n".join(kept).rstrip("\n") + "\n")
    os.replace(ALLOWED_KEYS_PATH + ".tmp", ALLOWED_KEYS_PATH)
    logger.info("Admin: removed %d lines (finger=%s profile=%s)", removed, finger, profile)
    return removed

# ---------- Routes ----------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": CORS_ORIGINS}})

@app.route("/", methods=["GET"])
def index():
    return "✅ Fonsida Server (no-expiry) is running!"

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

    if filename not in ALLOWED_FILES:
        logger.warning("Denied file request (not whitelisted) filename=%s ip=%s", filename, client_ip)
        return "❌ File not allowed", 403

    finger = request.args.get("finger") or request.args.get("key")
    profile = request.args.get("profile")
    # fallback to header or cookie if profile missing
    if not profile:
        profile = request.headers.get("X-Profile") or request.cookies.get("ziga_profile")

    short_f = (finger[:16] + "...") if finger and len(finger) > 16 else (finger or "<NONE>")
    logger.debug("Incoming request file=%s ip=%s finger=%s profile=%s args=%s", filename, client_ip, short_f, profile, dict(request.args))

    if not finger or not profile:
        logger.info("Missing params for request from ip=%s filename=%s finger=%s profile=%s", client_ip, filename, short_f, profile)
        return "❌ Missing fingerprint or profile", 400

    finger = finger.strip()
    profile = profile.strip()

    if not is_valid_key(finger, profile):
        logger.info("Invalid access attempt ip=%s filename=%s finger=%s profile=%s", client_ip, filename, (finger[:12] + "...") if len(finger) > 12 else finger, profile)
        return "❌ Sai key hoặc profile không hợp lệ", 403

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

# Admin endpoints (optional)
@app.route("/admin/list", methods=["GET"])
def admin_list():
    _require_admin()
    allowed = load_allowed_keys()
    return jsonify({"count": len(allowed), "keys": [{"finger": f, "profile": p} for f,p in allowed]})

@app.route("/admin/add", methods=["POST"])
def admin_add():
    _require_admin()
    data = request.get_json() or {}
    finger = data.get("finger")
    profile = data.get("profile")
    if not finger or not profile:
        return jsonify({"error": "finger & profile required"}), 400
    admin_add_key(finger.strip(), profile.strip())
    return jsonify({"ok": True})

@app.route("/admin/remove", methods=["POST"])
def admin_remove():
    _require_admin()
    data = request.get_json() or {}
    finger = data.get("finger")
    profile = data.get("profile")
    if not finger and not profile:
        return jsonify({"error": "finger or profile required"}), 400
    removed = admin_remove_key(finger=finger.strip() if finger else None, profile=profile.strip() if profile else None)
    return jsonify({"removed": removed})

# ---------- Run ----------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    logger.info("Starting Fonsida no-expiry server on 0.0.0.0:%s", port)
    app.run(host="0.0.0.0", port=port, debug=False)
