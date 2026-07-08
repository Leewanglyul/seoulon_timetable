import base64
import json
import os
import sys
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
import upload  # noqa: E402

SAMPLE_CSV = "강의실,교사명,월1\n요일,,월\n교시,교사명,1교시\n강의실 1,홍길동,\n"


class FakeResponse:
    def __init__(self, status, payload):
        self.status = status
        self._payload = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class TestUpload(unittest.TestCase):
    def setUp(self):
        os.environ["ADMIN_PASSWORD"] = "secret123"
        os.environ["GITHUB_REPO"] = "myuser/timetable-app"
        os.environ["GITHUB_BRANCH"] = "main"
        os.environ["GITHUB_TOKEN"] = "ghp_faketoken"

    def test_wrong_password_rejected(self):
        status, resp = upload.process_upload("wrong", SAMPLE_CSV)
        self.assertEqual(status, 401)
        self.assertIn("error", resp)

    def test_invalid_csv_rejected(self):
        status, resp = upload.process_upload("secret123", "not,a,valid,header\n")
        self.assertEqual(status, 400)

    def test_missing_env_reported(self):
        del os.environ["GITHUB_TOKEN"]
        status, resp = upload.process_upload("secret123", SAMPLE_CSV)
        self.assertEqual(status, 500)

    @patch("upload.urllib.request.urlopen")
    def test_successful_commit_flow(self, mock_urlopen):
        get_resp = FakeResponse(200, {"sha": "abc123"})
        put_resp = FakeResponse(200, {"content": {"sha": "def456"}})
        mock_urlopen.side_effect = [get_resp, put_resp]

        status, resp = upload.process_upload("secret123", SAMPLE_CSV)

        self.assertEqual(status, 200)
        self.assertTrue(resp.get("ok"))
        self.assertEqual(mock_urlopen.call_count, 2)

        get_req = mock_urlopen.call_args_list[0][0][0]
        self.assertIn("contents/api/_data/timetable.csv?ref=main", get_req.full_url)
        self.assertEqual(get_req.headers.get("Authorization"), "Bearer ghp_faketoken")

        put_req = mock_urlopen.call_args_list[1][0][0]
        self.assertEqual(put_req.method, "PUT")
        body = json.loads(put_req.data.decode("utf-8"))
        self.assertEqual(body["sha"], "abc123")
        self.assertEqual(body["branch"], "main")
        decoded = base64.b64decode(body["content"]).decode("utf-8")
        self.assertEqual(decoded, SAMPLE_CSV)

    @patch("upload.urllib.request.urlopen")
    def test_first_upload_no_existing_sha(self, mock_urlopen):
        import urllib.error

        not_found = urllib.error.HTTPError("url", 404, "Not Found", {}, None)
        not_found.read = lambda: b'{"message": "Not Found"}'
        put_resp = FakeResponse(201, {"content": {"sha": "xyz"}})
        mock_urlopen.side_effect = [not_found, put_resp]

        status, resp = upload.process_upload("secret123", SAMPLE_CSV)
        self.assertEqual(status, 200)
        put_req = mock_urlopen.call_args_list[1][0][0]
        body = json.loads(put_req.data.decode("utf-8"))
        self.assertNotIn("sha", body)


if __name__ == "__main__":
    unittest.main()
