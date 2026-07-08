"""Vercel Python 서버리스 함수: 로그인한 사용자에게만 시간표 CSV를 제공한다.

교사 이름 등 개인정보가 포함되어 있어, Microsoft Entra ID로 로그인해 발급받은
ID 토큰(Authorization: Bearer ...)을 검증한 요청에만 데이터를 반환한다.
"""

import os
from http.server import BaseHTTPRequestHandler

from _auth import AuthError, verify_bearer_token

DATA_FILE = os.path.join(os.path.dirname(__file__), "_data", "timetable.csv")


class handler(BaseHTTPRequestHandler):
    def _send_error(self, status, message):
        body = message.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        try:
            verify_bearer_token(self.headers.get("Authorization"))
        except AuthError as e:
            self._send_error(401, str(e))
            return

        with open(DATA_FILE, "rb") as f:
            content = f.read()
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)
