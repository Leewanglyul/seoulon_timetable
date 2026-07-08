"""Vercel Python 서버리스 함수: 관리자 CSV 업로드.

관리자 비밀번호를 확인한 뒤, GitHub Contents API로 data/timetable.csv 파일을
저장소에 직접 커밋한다. 저장소가 Vercel과 Git 연동되어 있으므로 커밋이 들어가면
자동으로 재배포되어 조회 페이지에 새 데이터가 반영된다.

필요한 환경 변수 (Vercel 프로젝트 설정 > Environment Variables):
  ADMIN_PASSWORD  관리자 업로드 페이지 비밀번호
  GITHUB_TOKEN    contents:write 권한을 가진 GitHub Fine-grained PAT
  GITHUB_REPO     "owner/repo" 형식의 저장소 이름
  GITHUB_BRANCH   커밋할 브랜치 이름 (예: main)
"""

import base64
import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler

GITHUB_API = "https://api.github.com"
DATA_PATH = "data/timetable.csv"


class GithubUpdateError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def _github_request(url, token, method="GET", body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8")
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            pass
        raise GithubUpdateError(e.code, payload)


def get_current_sha(repo, branch, token):
    url = f"{GITHUB_API}/repos/{repo}/contents/{DATA_PATH}?ref={branch}"
    try:
        _, payload = _github_request(url, token)
        return payload.get("sha")
    except GithubUpdateError as e:
        if e.status == 404:
            return None
        raise


def commit_csv(repo, branch, token, csv_text):
    sha = get_current_sha(repo, branch, token)
    content_b64 = base64.b64encode(csv_text.encode("utf-8")).decode("ascii")
    body = {
        "message": "chore: 시간표 데이터 업데이트 (관리자 업로드)",
        "content": content_b64,
        "branch": branch,
    }
    if sha:
        body["sha"] = sha
    url = f"{GITHUB_API}/repos/{repo}/contents/{DATA_PATH}"
    return _github_request(url, token, method="PUT", body=body)


def validate_csv(csv_text):
    if not csv_text or not csv_text.strip():
        return "CSV 내용이 비어 있습니다."
    first_lines = csv_text.strip().splitlines()[:1]
    if not first_lines or "강의실" not in first_lines[0] or "교사명" not in first_lines[0]:
        return "CSV 헤더가 예상 형식과 다릅니다 (강의실, 교사명으로 시작해야 함)."
    return None


def process_upload(password, csv_text):
    """반환값: (status_code, response_dict)"""
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_password:
        return 500, {"error": "서버에 ADMIN_PASSWORD 환경변수가 설정되어 있지 않습니다."}
    if password != admin_password:
        return 401, {"error": "비밀번호가 올바르지 않습니다."}

    error = validate_csv(csv_text)
    if error:
        return 400, {"error": error}

    repo = os.environ.get("GITHUB_REPO")
    branch = os.environ.get("GITHUB_BRANCH", "main")
    token = os.environ.get("GITHUB_TOKEN")
    if not repo or not token:
        return 500, {"error": "서버에 GITHUB_REPO / GITHUB_TOKEN 환경변수가 설정되어 있지 않습니다."}

    try:
        commit_csv(repo, branch, token, csv_text)
    except GithubUpdateError as e:
        return 502, {"error": f"GitHub 저장소 업데이트 실패 ({e.status}): {e.message}"}

    return 200, {"ok": True}


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json(400, {"error": "잘못된 요청 형식입니다."})
            return

        password = payload.get("password", "")
        csv_text = payload.get("csv", "")
        status, response = process_upload(password, csv_text)
        self._send_json(status, response)
