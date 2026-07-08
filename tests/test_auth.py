import os
import sys
import time
import unittest
from unittest.mock import MagicMock, patch

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
import _auth  # noqa: E402

TENANT_ID = "11111111-1111-1111-1111-111111111111"
CLIENT_ID = "22222222-2222-2222-2222-222222222222"


def make_token(private_key, **overrides):
    now = int(time.time())
    claims = {
        "iss": f"https://login.microsoftonline.com/{TENANT_ID}/v2.0",
        "aud": CLIENT_ID,
        "tid": TENANT_ID,
        "iat": now,
        "exp": now + 3600,
        "name": "홍길동",
        "preferred_username": "hong@seoulonline.sen.hs.kr",
    }
    claims.update(overrides)
    return jwt.encode(claims, private_key, algorithm="RS256")


class TestAuth(unittest.TestCase):
    def setUp(self):
        os.environ["MS_TENANT_ID"] = TENANT_ID
        os.environ["MS_CLIENT_ID"] = CLIENT_ID
        self.private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.public_key = self.private_key.public_key()
        _auth._jwks_client_cache.clear()

    def _patch_jwks(self):
        fake_signing_key = MagicMock()
        fake_signing_key.key = self.public_key
        fake_client = MagicMock()
        fake_client.get_signing_key_from_jwt.return_value = fake_signing_key
        return patch("_auth.PyJWKClient", return_value=fake_client)

    def test_missing_config_raises(self):
        del os.environ["MS_TENANT_ID"]
        with self.assertRaises(_auth.AuthError):
            _auth.verify_bearer_token("Bearer whatever")

    def test_missing_header_raises(self):
        with self.assertRaises(_auth.AuthError):
            _auth.verify_bearer_token(None)

    def test_non_bearer_header_raises(self):
        with self.assertRaises(_auth.AuthError):
            _auth.verify_bearer_token("Basic abc123")

    def test_valid_token_accepted(self):
        token = make_token(self.private_key)
        with self._patch_jwks():
            claims = _auth.verify_bearer_token(f"Bearer {token}")
        self.assertEqual(claims["tid"], TENANT_ID)
        self.assertEqual(claims["preferred_username"], "hong@seoulonline.sen.hs.kr")

    def test_wrong_audience_rejected(self):
        token = make_token(self.private_key, aud="different-client-id")
        with self._patch_jwks():
            with self.assertRaises(_auth.AuthError):
                _auth.verify_bearer_token(f"Bearer {token}")

    def test_wrong_issuer_rejected(self):
        token = make_token(self.private_key, iss="https://login.microsoftonline.com/other-tenant/v2.0")
        with self._patch_jwks():
            with self.assertRaises(_auth.AuthError):
                _auth.verify_bearer_token(f"Bearer {token}")

    def test_wrong_tenant_claim_rejected(self):
        # iss는 우리 테넌트로 위조했지만 tid 클레임 자체가 다른 조직인 경우도 막아야 한다.
        token = make_token(self.private_key, tid="other-tenant-id")
        with self._patch_jwks():
            with self.assertRaises(_auth.AuthError):
                _auth.verify_bearer_token(f"Bearer {token}")

    def test_expired_token_rejected(self):
        now = int(time.time())
        token = make_token(self.private_key, iat=now - 7200, exp=now - 3600)
        with self._patch_jwks():
            with self.assertRaises(_auth.AuthError):
                _auth.verify_bearer_token(f"Bearer {token}")

    def test_tampered_signature_rejected(self):
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        token = make_token(other_key)  # 다른 키로 서명됨
        with self._patch_jwks():
            with self.assertRaises(_auth.AuthError):
                _auth.verify_bearer_token(f"Bearer {token}")


if __name__ == "__main__":
    unittest.main()
