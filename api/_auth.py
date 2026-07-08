"""공유 인증 유틸리티 (Vercel이 밑줄로 시작하는 파일은 라우트로 만들지 않으므로 안전하게
다른 함수들에서 import해서 쓸 수 있다).

프론트엔드(MSAL.js)가 Microsoft Entra ID로 로그인한 뒤 발급받은 ID 토큰을
Authorization: Bearer <토큰> 헤더로 보내면, 이 모듈이 Microsoft의 공개키(JWKS)로
서명을 검증하고 발급자·대상(tenant/client)이 우리 조직 앱과 일치하는지 확인한다.

필요한 환경 변수:
  MS_TENANT_ID  Entra ID 앱이 등록된 조직의 디렉터리(테넌트) ID
  MS_CLIENT_ID  등록한 앱의 애플리케이션(클라이언트) ID
"""

import os

import jwt
from jwt import PyJWKClient

_jwks_client_cache = {}


class AuthError(Exception):
    pass


def _get_jwks_client(tenant_id):
    if tenant_id not in _jwks_client_cache:
        jwks_url = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
        _jwks_client_cache[tenant_id] = PyJWKClient(jwks_url)
    return _jwks_client_cache[tenant_id]


def verify_bearer_token(auth_header):
    """Authorization 헤더 값을 검증하고 성공 시 토큰 클레임(dict)을 반환한다.
    설정이 없거나 검증에 실패하면 AuthError를 발생시킨다."""
    tenant_id = os.environ.get("MS_TENANT_ID")
    client_id = os.environ.get("MS_CLIENT_ID")
    if not tenant_id or not client_id:
        raise AuthError("서버에 MS_TENANT_ID / MS_CLIENT_ID가 설정되어 있지 않습니다.")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise AuthError("인증 토큰이 없습니다.")
    token = auth_header[len("Bearer "):].strip()

    try:
        jwks_client = _get_jwks_client(tenant_id)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=f"https://login.microsoftonline.com/{tenant_id}/v2.0",
        )
    except jwt.PyJWTError as e:
        raise AuthError(f"토큰 검증 실패: {e}")

    if claims.get("tid") != tenant_id:
        raise AuthError("허용되지 않은 조직의 계정입니다.")

    return claims
