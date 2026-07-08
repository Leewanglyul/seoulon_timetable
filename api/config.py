"""Vercel Python 서버리스 함수: 프론트엔드에 MS Entra ID 로그인 설정값을 제공한다.

MS_CLIENT_ID / MS_TENANT_ID는 비밀값이 아니라 공개 클라이언트(SPA) 식별자이므로
그대로 노출해도 안전하다 (OAuth 공개 클라이언트의 표준적인 동작).
"""

import json
import os
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        client_id = os.environ.get("MS_CLIENT_ID")
        tenant_id = os.environ.get("MS_TENANT_ID")
        configured = bool(client_id and tenant_id)
        payload = {
            "configured": configured,
            "clientId": client_id if configured else None,
            "tenantId": tenant_id if configured else None,
        }
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
