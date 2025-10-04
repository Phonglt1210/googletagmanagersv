#!/usr/bin/env python3
# server.py
"""
Fonsida file server with robust allowkeys handling.

allowkeys.txt format (one line per key):
  BASE64_FINGER|profile-name|expiry_epoch_seconds

- If expiry is missing or unparsable:
    * if DEFAULT_EXPIRY_SECONDS env var set -> expiry = now + DEFAULT_EXPIRY_SECONDS
    * else expiry = None (meaning "no expiry" = valid until removed)
- Matching logic: accept request if any line matches finger+profile and that entry is not expired.
- Provides optional admin endpoints protected by ADMIN_SECRET env var for add/remove/list keys.

Environment variables (optional):
  PORT=5000
  ALLOWED_FILES (comma separated) default: ttc.js,cut.js,ram.js,atjr.js,rd.js,rmrd.js
  MAX_REQ_PER_WINDOW default 120
  RATE_WINDOW_SECONDS default 60
  CORS_ORIGINS default *
  DEFAULT_EXPIRY_SECONDS (int seconds) optional - default behavior is "no expiry"
  ADMIN_SECRET optional - if set enables /admin endpoints protected by this secret
"""

import os
import time
import logging
from typing import List, Tuple, Optional
from flask import Flask, request, send_from_directory, jsonify, make_response, abort
from flask_cors import CORS

# ---------- Configuration ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_KEYS_PATH = os.path.join(BASE_DIR, "allowkeys.txt")

ALLOWED_FILES = set(
    x.strip() for x in os.environ.get("ALLOWED_FILES", "ttc.js,cut.js,ram.js,atjr.js,rd.js,rmrd.js").split(",") if x.strip()
)

MAX_REQ_PER_WINDOW = int(os.environ.get("MAX_REQ_PER_WINDOW", "120"))
WINDOW_SECONDS = int(os.environ.get("RATE_WINDOW_SECONDS", "60"))

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
DEFAULT_EXPIRY_SECONDS = os.environ.get("DEFAULT_EXPIRY_SECONDS")  # optional
DEFAULT_EXPIRY_SECONDS = int(DEFAULT_EXPIRY_SECONDS) if DEFAULT_EXPIRY_SECONDS and DEFAULT_EXPIRY_SECONDS.isdigit() else None

ADMIN_SECRET = os.environ.get("ADMIN_SECRET")  # if set, admin endpoints require this secret

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fonsida-server")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": CORS_ORIGINS}})

# In-memory rate limit store
_rate_store = {}

# ---------- Helpers ----------
def _now() -> int:
    return int(time.time())

def normalize_b64(s: str) -> str:
    """Return base64 string trimmed of whitespace and optionally without trailing '=' for tolerant compare."""
    if s is None:
        return ""
    return s.strip()

def b64_variants(s: str) -> List[str]:
    """
    Return variants to compare: original (strip) and no-padding variant (rstrip '=').
    This allows matching both padded/unpadded forms conservatively.
    """
    s0 = normalize_b64(s)
    s1 = s0.rstrip("=")
    if s1 == s0:
        return [s0]
    else:
        return [s0, s1]

def load_allowed_keys_with_exp() -> List[Tuple[str, str, Optional[int]]]:
    """
    Read allowkeys.txt lines of form:
      BASE64FINGER|profile_name|expiry_epoch
    Lines starting with # or blank are ignored.
    If expiry missing/unparsable:
      - if DEFAULT_EXPIRY_SECONDS set: expiry = now + DEFAULT_EXPIRY_SECONDS
      - else expiry = None (meaning never-expire)
    Returns list of (finger_base64, profile, expiry_or_None).
    """
    results: List[Tuple[str, str, Optional[int]]] = []
    if not os.path.exists(ALLOWED_KEYS_PATH):
        return results
    try:
        with open(ALLOWED_KEYS_PATH, "r", encoding="utf-8") as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("|")
                # minimum: finger|profile
                if len(parts) < 2:
                    logger.debug("Skipping malformed allowkeys line (too few parts): %r", line)
                    continue
                finger = parts[0].strip()
                profile = parts[1].strip()
                expiry: Optional[int] = None
                if len(parts) >= 3:
                    expiry_part = "|".join(parts[2:]).strip()
                    if expiry_part != "":
                        try:
                            expiry = int(expiry_part)
                        except Exception:
                            # unparsable expiry -> fallback
                            expiry = None
                # handle DEFAULT_EXPIRY_SECONDS if set and expiry is None
                if expiry is None and DEFAULT_EXPIRY_SECONDS is not None:
                    expiry = _now() + DEFAULT_EXPIRY_SECONDS
                    logger.debug("Assigned default expiry for %s|%s -> %s", finger, profile, expiry)
                # store normalized finger (strip)
                results.append((finger, profile, expiry))
    except Exception as e:
        logger.exception("Failed to load allowkeys.txt: %s", e)
    return results

def is_valid_key(finger: str, profile: str) -> bool:
    """
    Validate that (finger, profile) exists in allowkeys and at least one matching entry is not expired.
    expiry == None means no expiry (treat as valid until removed).
    This function tolerates base64 padding variants (both padded and no-pad).
    """
    if not finger or not profile:
        return False
    now = _now()
    # load each request for immediate effect if file changed
    allowed = load_allowed_keys_with_exp()
    if not allowed:
        logger.debug("No allowed keys loaded (allowkeys.txt empty or missing)")
        return False

    # prepare variants for tolerant matching
    req_variants = set(b64_variants(finger))

    matched_any = False
    for saved_finger, saved_profile, expiry in allowed:
        if saved_profile != profile:
            continue
        # tolerant compare: check if any variant equals saved or saved without padding equals variant
        saved_variants = set(b64_variants(saved_finger))
        if req_variants & saved_variants:
            matched_any = True
            if expiry is None:
                logger.info("Valid key: matched (no expiry) profile=%s", profile)
                return True
            if expiry > now:
                logger.info("Valid key: matched (expiry OK) profile=%s expiry=%s now=%s", profile, expiry, now)
                return True
            else:
                # matched but expired: continue searching other entries
                logger.info("Matched key but expired for profile=%s expiry=%s now=%s", profile, expiry, now)
    if not matched_any:
        logger.debug("No matching finger|profile found for profile=%s", profile)
    return False

def check_rate_limit(client_ip: str) -> bool:
    now = _now()
    entry = _rate_store.get(client_ip)
    if entry is None:
        _rate_store[client_ip] = [1, now]
        return True
    count, window_start = entry
    if now - window_start >= WINDOW_SECONDS:
        _rate_store[client_ip] = [1, now]
        return True
    else:
        if count + 1 > MAX_REQ_PER_WINDOW:
            return False
        else:
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

def add_key_line(finger: str, profile: str, expiry: Optional[int]) -> None:
    line = f"{finger}|{profile}|{expiry if expiry is not None else ''}"
    with open(ALLOWED_KEYS_PATH, "a", encoding="utf-8") as fh:
        fh.write(line.rstrip() + "\n")
    logger.info("Appended allowkey line for profile=%s", profile)

def remove_key_lines(finger: Optional[str]=None, profile: Optional[str]=None) -> int:
    """
    Remove lines matching finger and/or profile.
    If both provided, remove lines matching both.
    Returns number of removed lines.
    """
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
            if finger and normalize_b64(finger) not in b64_variants(lf):
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
    logger.info("Removed %d allowkey lines (finger=%s profile=%s)", removed, finger, profile)
    return removed

# ---------- Routes ----------
@app.route("/", methods=["GET"])
def index():
    return "✅ Fonsida Server is running!"

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

    # Accept 'finger' or legacy 'key'
    finger = request.args.get("finger") or request.args.get("key")
    profile = request.args.get("profile")

    # fallback: check header/cookie if profile absent (helps race conditions on client side)
    if not profile:
        profile = request.headers.get("X-Profile") or request.cookies.get("ziga_profile")

    # log trimmed for safety
    short_f = (finger[:16] + "...") if finger and len(finger) > 16 else (finger or "<NONE>")
    logger.debug("Incoming request file=%s ip=%s finger=%s profile=%s args=%s", filename, client_ip, short_f, profile, dict(request.args))

    if not finger or not profile:
        logger.info("Missing params for request from ip=%s filename=%s finger=%s profile=%s",
                    client_ip, filename, short_f, profile)
        return "❌ Missing fingerprint or profile", 400

    finger = finger.strip()
    profile = profile.strip()

    if not is_valid_key(finger, profile):
        logger.info("Invalid or expired access attempt ip=%s filename=%s finger=%s profile=%s",
                    client_ip, filename, (finger[:12] + "...") if len(finger) > 12 else finger, profile)
        return "❌ Sai key hoặc profile không hợp lệ hoặc đã hết hạn", 403

    # Serve file with no-store headers
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

# ---------- Admin endpoints (optional) ----------
@app.route("/admin/list", methods=["GET"])
def admin_list():
    _require_admin()
    allowed = load_allowed_keys_with_exp()
    out = []
    for f, p, e in allowed:
        out.append({"finger": f, "profile": p, "expiry": e})
    return jsonify({"count": len(out), "keys": out})

@app.route("/admin/add", methods=["POST"])
def admin_add():
    _require_admin()
    data = request.get_json() or {}
    finger = data.get("finger")
    profile = data.get("profile")
    expiry = data.get("expiry")  # int or None
    if not finger or not profile:
        return jsonify({"error": "finger & profile required"}), 400
    if expiry is not None:
        try:
            expiry = int(expiry)
        except:
            expiry = None
    add_key_line(finger.strip(), profile.strip(), expiry)
    return jsonify({"ok": True})

@app.route("/admin/remove", methods=["POST"])
def admin_remove():
    _require_admin()
    data = request.get_json() or {}
    finger = data.get("finger")
    profile = data.get("profile")
    if not finger and not profile:
        return jsonify({"error": "finger or profile required"}), 400
    removed = remove_key_lines(finger=finger.strip() if finger else None, profile=profile.strip() if profile else None)
    return jsonify({"removed": removed})

# ---------- Run ----------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    logger.info("Starting Fonsida server on 0.0.0.0:%s", port)
    app.run(host="0.0.0.0", port=port, debug=False)
