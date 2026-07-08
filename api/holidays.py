"""Vercel Python 서버리스 함수: 공공데이터포털 '특일 정보' 공휴일 조회.

2학기 기간(2026-08-13 ~ 2027-02-05)에 걸친 연도의 공휴일만 조회해서 반환한다.

필요한 환경 변수 (Vercel 프로젝트 설정 > Environment Variables):
  HOLIDAY_API_KEY  공공데이터포털에서 발급받은 "한국천문연구원_특일 정보" 서비스키
                    (마이페이지의 '일반 인증키(Decoding)' 값을 그대로 사용)
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler

API_BASE = "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"
YEARS = [2026, 2027]  # 2학기(2026-08-13~2027-02-05)에 걸치는 연도


def _fetch_year(year, service_key):
    params = {
        "serviceKey": service_key,
        "solYear": str(year),
        "numOfRows": "100",
        "_type": "json",
    }
    url = API_BASE + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=8) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    body = payload.get("response", {}).get("body", {})
    items = body.get("items")
    if not isinstance(items, dict):
        return []
    item = items.get("item")
    if not item:
        return []
    if isinstance(item, dict):
        item = [item]
    return item


def get_holidays(service_key):
    results = []
    for year in YEARS:
        for entry in _fetch_year(year, service_key):
            if entry.get("isHoliday") != "Y":
                continue
            locdate = str(entry.get("locdate"))
            date_str = f"{locdate[0:4]}-{locdate[4:6]}-{locdate[6:8]}"
            results.append({"date": date_str, "name": entry.get("dateName", "공휴일")})
    return results


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload, cache=False):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        if cache:
            self.send_header("Cache-Control", "public, max-age=86400")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        service_key = os.environ.get("HOLIDAY_API_KEY")
        if not service_key:
            self._send_json(200, {"holidays": [], "error": "HOLIDAY_API_KEY 환경변수가 설정되어 있지 않습니다."})
            return
        try:
            holidays = get_holidays(service_key)
        except (urllib.error.URLError, ValueError, KeyError) as e:
            self._send_json(200, {"holidays": [], "error": f"공휴일 API 호출 실패: {e}"})
            return
        self._send_json(200, {"holidays": holidays}, cache=True)
