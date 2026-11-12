#!/usr/bin/env python3
"""
Fusion Manage connection test (read-only).

Signs you in to Autodesk with PKCE (no client secret), then asks your Fusion Manage tenant for its
workspace list. It tells you whether the tenant accepts your APS app and which URL style works.

Run on your own computer (Python 3.9+, no extra packages):
    python fusion_manage_probe.py --client-id <YOUR_APS_CLIENT_ID> [--list-workspaces]
    (or set the environment variable APS_CLIENT_ID)

Needs:
  * the APS app type "Desktop, Mobile, Single-Page App" with callback URL http://localhost:8080/callback
  * the Client ID added to Fusion Manage > Administration > Security > Allowed client IDs

What it never does: print or save the access token, or change anything in Fusion Manage.
"""
import argparse, base64, hashlib, http.server, json, os, secrets, sys, threading, urllib.error
import urllib.parse, urllib.request, webbrowser

AUTH_URL = "https://developer.api.autodesk.com/authentication/v2/authorize"
TOKEN_URL = "https://developer.api.autodesk.com/authentication/v2/token"
CALLBACK_HOST, CALLBACK_PORT, CALLBACK_PATH = "127.0.0.1", 8080, "/callback"
REDIRECT_URI = f"http://localhost:{CALLBACK_PORT}{CALLBACK_PATH}"   # must match the APS app exactly


def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def login(client_id: str, scope: str) -> str:
    verifier = b64url(secrets.token_bytes(48))
    challenge = b64url(hashlib.sha256(verifier.encode()).digest())
    state = secrets.token_urlsafe(16)
    result = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            u = urllib.parse.urlparse(self.path)
            if u.path != CALLBACK_PATH:
                self.send_response(404); self.end_headers(); return
            q = urllib.parse.parse_qs(u.query)
            result.update({k: v[0] for k, v in q.items()})
            self.send_response(200); self.send_header("Content-Type", "text/html"); self.end_headers()
            self.wfile.write(b"<h3>Signed in. You can close this tab and go back to the terminal.</h3>")
        def log_message(self, *a): pass

    srv = http.server.HTTPServer((CALLBACK_HOST, CALLBACK_PORT), Handler)
    srv.timeout = 1
    url = AUTH_URL + "?" + urllib.parse.urlencode({
        "response_type": "code", "client_id": client_id, "redirect_uri": REDIRECT_URI,
        "scope": scope, "state": state, "code_challenge": challenge, "code_challenge_method": "S256"})
    print("Opening your browser to sign in. If nothing opens, paste this URL into a browser:\n" + url + "\n")
    webbrowser.open(url)
    for _ in range(180):                       # wait up to 3 minutes
        srv.handle_request()
        if result: break
    srv.server_close()
    if "error" in result:
        sys.exit(f"Sign-in failed: {result.get('error')} {result.get('error_description', '')}")
    if result.get("state") != state or "code" not in result:
        sys.exit("No valid sign-in response received (timed out, or the state did not match).")

    body = urllib.parse.urlencode({
        "grant_type": "authorization_code", "code": result["code"], "client_id": client_id,
        "redirect_uri": REDIRECT_URI, "code_verifier": verifier}).encode()
    req = urllib.request.Request(TOKEN_URL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            tok = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Token request failed: HTTP {e.code} {e.read().decode(errors='replace')[:300]}")
    return tok["access_token"]


def token_info(token: str):
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        d = json.loads(base64.urlsafe_b64decode(payload))
        return {"scope": d.get("scope"), "expires_in_s": d.get("exp", 0) - d.get("iat", 0)}
    except Exception:
        return {}


def probe(url: str, token: str, extra_headers=None):
    h = {"Authorization": "Bearer " + token, "Accept": "application/json"}
    h.update(extra_headers or {})
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=30) as r:
            return r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except Exception as e:
        return None, str(e)


def print_workspaces(body: str):
    """Parse and neatly list workspace IDs and names from Fusion Manage JSON response."""
    try:
        data = json.loads(body)
        items = []
        if isinstance(data, dict):
            items = data.get("items", []) or data.get("list", []) or data.get("workspaces", [])
        elif isinstance(data, list):
            items = data

        if not items:
            print("\n  [No workspace items found in response payload]")
            return

        print("\n=== Workspaces Found ===")
        for item in items:
            if not isinstance(item, dict):
                continue
            ws_id = item.get("id") or item.get("workspaceId") or item.get("link", "").split("/")[-1]
            name = item.get("name") or item.get("title") or item.get("displayName") or "Unnamed Workspace"
            print(f"  ID: {str(ws_id):<8} | Name: {name}")
        print("========================")
    except Exception as e:
        print(f"\n  Could not parse workspace JSON: {e}")


def main():
    ap = argparse.ArgumentParser(description="Fusion Manage API Probe")
    ap.add_argument("--client-id", default=os.environ.get("APS_CLIENT_ID"))
    ap.add_argument("--tenant", default="fti")
    ap.add_argument("--scope", default="data:read")
    ap.add_argument("--list-workspaces", action="store_true", help="Print workspace names and IDs upon successful connection")
    a = ap.parse_args()
    
    if not a.client_id:
        sys.exit("Give your APS Client ID with --client-id or the APS_CLIENT_ID environment variable.")

    token = login(a.client_id.strip(), a.scope)
    print("Signed in. Token received (not shown). Granted:", token_info(token), "\n")

    base = f"https://{a.tenant}.autodeskplm360.net"
    tries = [
        ("tenant REST v3 workspaces", f"{base}/api/v3/workspaces?limit=100", {}),
        ("tenant REST v1 workspaces", f"{base}/api/rest/v1/workspaces", {}),
    ]
    ok = False
    for name, url, hdr in tries:
        status, body = probe(url, token, hdr)
        print(f"[{name}] {url}\n   HTTP {status}")
        snippet = " ".join(body.split())[:400]
        print("   " + snippet + "\n")
        
        if status == 200:
            ok = True
            if a.list_workspaces:
                print_workspaces(body)
                break

    print("\nRESULT:", "at least one endpoint answered 200 (the tenant accepted the app)." if ok else
          "no endpoint answered 200. Copy the output above (without the token, which is never shown) and send it back.")


if __name__ == "__main__":
    main()