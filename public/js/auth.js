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

// 로그인 상태만 확인한다 (미로그인이어도 리디렉션하지 않음).
// 반환값: { configured, signedIn, idToken?, account? }
async function checkAuthStatus() {
  const instance = await initMsal();
  if (!instance) return { configured: false, signedIn: false };

  const account = instance.getAllAccounts()[0];
  if (!account) return { configured: true, signedIn: false };

  const result = await instance.acquireTokenSilent({ account, scopes: ["openid", "profile"] });
  return { configured: true, signedIn: true, idToken: result.idToken, account };
}

// 로그인 버튼 클릭 시 호출 — Microsoft 로그인 화면으로 이동한다.
async function triggerLogin() {
  const instance = await initMsal();
  if (!instance) return;
  await instance.loginRedirect({ scopes: ["openid", "profile"] });
}

function signOut() {
  if (msalInstance) {
    msalInstance.logoutRedirect();
  }
}
