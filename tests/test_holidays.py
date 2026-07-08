import json
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
import holidays  # noqa: E402


class FakeResponse:
    def __init__(self, payload):
        self._payload = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def make_payload(items):
    return {
        "response": {
            "header": {"resultCode": "00", "resultMsg": "NORMAL SERVICE."},
            "body": {"items": {"item": items} if items else {"items": ""}, "numOfRows": 100, "pageNo": 1},
        }
    }


class TestHolidays(unittest.TestCase):
    @patch("holidays.urllib.request.urlopen")
    def test_single_item_dict_normalized_to_list(self, mock_urlopen):
        payload_2026 = make_payload({"dateKind": "01", "dateName": "광복절", "isHoliday": "Y", "locdate": 20260815, "seq": 1})
        payload_2027 = make_payload(None)
        mock_urlopen.side_effect = [FakeResponse(payload_2026), FakeResponse(payload_2027)]

        result = holidays.get_holidays("fake-key")
        self.assertEqual(result, [{"date": "2026-08-15", "name": "광복절"}])

    @patch("holidays.urllib.request.urlopen")
    def test_multiple_items_and_non_holiday_filtered(self, mock_urlopen):
        items_2026 = [
            {"dateKind": "01", "dateName": "추석", "isHoliday": "Y", "locdate": 20260924, "seq": 1},
            {"dateKind": "01", "dateName": "추석", "isHoliday": "Y", "locdate": 20260925, "seq": 1},
            {"dateKind": "02", "dateName": "국군의 날", "isHoliday": "N", "locdate": 20261001, "seq": 1},
        ]
        payload_2026 = make_payload(items_2026)
        payload_2027 = make_payload([{"dateKind": "01", "dateName": "설날", "isHoliday": "Y", "locdate": 20270205, "seq": 1}])
        mock_urlopen.side_effect = [FakeResponse(payload_2026), FakeResponse(payload_2027)]

        result = holidays.get_holidays("fake-key")
        self.assertEqual(
            result,
            [
                {"date": "2026-09-24", "name": "추석"},
                {"date": "2026-09-25", "name": "추석"},
                {"date": "2027-02-05", "name": "설날"},
            ],
        )

    @patch("holidays.urllib.request.urlopen")
    def test_empty_items_string_handled(self, mock_urlopen):
        payload = {
            "response": {
                "header": {"resultCode": "00", "resultMsg": "NORMAL SERVICE."},
                "body": {"items": "", "numOfRows": 100, "pageNo": 1, "totalCount": 0},
            }
        }
        mock_urlopen.side_effect = [FakeResponse(payload), FakeResponse(payload)]
        result = holidays.get_holidays("fake-key")
        self.assertEqual(result, [])


if __name__ == "__main__":
    unittest.main()
