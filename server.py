#!/usr/bin/env python3
# server.py (no rate limit, keep finger/profile security)
"""
Simple Fonsida file server (no-expiry, no IP rate limit)
- allowkeys.txt lines: BASE64_FINGER|profile
- Whitelisted files are hard-coded in ALLOWED_FILES
- Accepts query params: ?finger=<base64>&profile=<profile>
- Fallback: profile from header X-Profile or cookie ziga_profile
"""

import os
import logging
from typing import List, Tuple, Optional
from flask import Flask, request, send_from_directory, make_response, jsonify
from flask_cors import CORS

# ---------- Configuration ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_KEYS_PATH = os.path.join(BASE_DIR, "allowkeys.txt")

# hard-coded whitelist of files
ALLOWED_FILES = {"ttc.js", "rd.js", "atjr.js", "rmrd.js", "ard.js", "do.js"}

# CORS origin
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

# optional admin secret
ADMIN_SECRET = os.environ.get("ADMIN_SECRET")

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fonsida-noexpiry")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": CORS_ORIGINS}})

# ---------- Helpers ----------
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
    """Read allowkeys.txt -> [(finger, profile)]"""
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
                finger, profile = parts[0].strip(), parts[1].strip()
                if finger and profile:
                    out.append((finger, profile))
    except Exception as e:
        logger.exception("Failed to read allowkeys.txt: %s", e)
    return out

def is_valid_key(finger: str, profile: str) -> bool:
    """Validate given (finger, profile) from allowkeys.txt"""
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
        if req_vars & set(b64_variants(saved_f)):
            logger.info("Valid key matched profile=%s", profile)
            return True
    return False

# ---------- Routes ----------
@app.route("/", methods=["GET"])
def index():
    return "✅ Fonsida Server (no-expiry, no IP limit) running"

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.route("/<path:filename>", methods=["GET"])
def serve_file(filename):
    # whitelist check
    if filename not in ALLOWED_FILES:
        logger.warning("Denied file request (not whitelisted): %s", filename)
        return "❌ File not allowed", 403

    # get params
    finger = request.args.get("finger") or request.args.get("key")
    profile = request.args.get("profile")
    if not profile:
        profile = request.headers.get("X-Profile") or request.cookies.get("ziga_profile")

    if not finger or not profile:
        return "❌ Missing fingerprint or profile", 400

    finger = normalize(finger)
    profile = normalize(profile)

    # validate
    if not is_valid_key(finger, profile):
        logger.info("Invalid access attempt: finger=%s profile=%s",
                    finger[:12] + "...", profile)
        return "❌ Sai key hoặc profile không hợp lệ", 403

    # serve file
    filepath = os.path.join(BASE_DIR, filename)
    if os.path.exists(filepath):
        logger.info("Serving file=%s for profile=%s", filename, profile)
        resp = make_response(send_from_directory(BASE_DIR, filename))
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        return resp
    else:
        return "❌ File not found", 404

# ---------- Admin endpoints ----------
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
    finger, profile = data.get("finger"), data.get("profile")
    if not finger or not profile:
        return jsonify({"error": "finger & profile required"}), 400
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
    finger, profile = data.get("finger"), data.get("profile")
    if not finger and not profile:
        return jsonify({"error": "finger or profile required"}), 400
    removed = 0
    if os.path.exists(ALLOWED_KEYS_PATH):
        kept = []
        with open(ALLOWED_KEYS_PATH, "r", encoding="utf-8") as fh:
            for raw in fh:
                line = raw.rstrip("\n")
                if not line.strip() or line.startswith("#"):
                    kept.append(line)
                    continue
                parts = line.split("|")
                if len(parts) < 2:
                    kept.append(line)
                    continue
                lf, lp = parts[0].strip(), parts[1].strip()
                match = (not finger or lf in b64_variants(finger)) and (not profile or profile == lp)
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
    logger.info("Starting Fonsida server (no IP limit) on 0.0.0.0:%s", port)
    app.run(host="0.0.0.0", port=port, debug=False)
