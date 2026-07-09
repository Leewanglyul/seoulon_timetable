const MSAL_SDK_URL = "https://alcdn.msauth.net/browser/2.38.2/js/msal-browser.min.js";

let msalInstance = null;
let authConfigPromise = null;
let scriptLoadPromise = null;

function loadScript(src) {
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("로그인 스크립트를 불러오지 못했습니다."));
      document.head.appendChild(s);
    });
  }
  return scriptLoadPromise;
}

async function fetchAuthConfig() {
  if (!authConfigPromise) {
    authConfigPromise = fetch("/api/config")
      .then((res) => res.json())
      .catch(() => ({ configured: false }));
  }
  return authConfigPromise;
}

async function initMsal() {
  const config = await fetchAuthConfig();
  if (!config.configured) return null;
  if (!msalInstance) {
    await loadScript(MSAL_SDK_URL);
    msalInstance = new msal.PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        redirectUri: window.location.origin + window.location.pathname,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    await msalInstance.initialize();
    await msalInstance.handleRedirectPromise();
  }
  return msalInstance;
}

// 로그인 여부를 확인한다. 설정이 안 되어 있으면 { configured: false } 를 반환하고,
// 로그인이 안 되어 있으면 Microsoft 로그인 화면으로 리디렉션한다 (이 함수는 반환되지 않음).
// 로그인이 되어 있으면 { configured: true, idToken, account } 를 반환한다.
async function ensureSignedIn() {
  const instance = await initMsal();
  if (!instance) return { configured: false };

  let account = instance.getAllAccounts()[0];
  if (!account) {
    await instance.loginRedirect({ scopes: ["openid", "profile"] });
    return new Promise(() => {}); // 리디렉션 진행 중 — 페이지가 곧 이동함
  }

  const result = await instance.acquireTokenSilent({ account, scopes: ["openid", "profile"] });
  return { configured: true, idToken: result.idToken, account };
}

function signOut() {
  if (msalInstance) {
    msalInstance.logoutRedirect();
  }
}
