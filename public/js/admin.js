function showResult(message, isError) {
  const el = document.getElementById("result");
  el.innerHTML = `<p class="${isError ? "empty" : "summary"}" style="color:${isError ? "#c0392b" : "#1a7a3c"}">${message}</p>`;
}

async function handleSubmit() {
  const password = document.getElementById("password").value;
  const fileInput = document.getElementById("csv-file");
  const submitBtn = document.getElementById("submit-btn");

  if (!password) {
    showResult("비밀번호를 입력하세요.", true);
    return;
  }
  const file = fileInput.files[0];
  if (!file) {
    showResult("CSV 파일을 선택하세요.", true);
    return;
  }

  submitBtn.disabled = true;
  showResult("업로드 중...", false);

  try {
    const text = await file.text();

    // 클라이언트 단에서 미리 파싱 가능한 형식인지 검증
    const records = parseCsvText(text);
    if (records.length === 0) {
      showResult("CSV에서 유효한 수업 데이터를 찾지 못했습니다. 형식을 확인하세요.", true);
      submitBtn.disabled = false;
      return;
    }

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, csv: text }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      showResult(`업로드 성공 (${records.length}개 수업 인식). 배포가 반영되기까지 약 30초~1분 정도 걸릴 수 있습니다.`, false);
    } else {
      showResult("업로드 실패: " + (data.error || res.statusText), true);
    }
  } catch (err) {
    showResult("업로드 중 오류가 발생했습니다: " + err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
}

async function start() {
  const statusEl = document.getElementById("load-status");
  const loginGate = document.getElementById("login-gate");
  let auth;
  try {
    auth = await checkAuthStatus();
  } catch (err) {
    statusEl.textContent = "로그인 처리 중 오류가 발생했습니다: " + err.message;
    statusEl.classList.add("error");
    return;
  }

  if (!auth.configured) {
    statusEl.textContent = "관리자가 아직 로그인 인증을 설정하지 않아 접근할 수 없습니다.";
    statusEl.classList.add("error");
    return;
  }

  if (!auth.signedIn) {
    statusEl.textContent = "로그인이 필요합니다.";
    loginGate.style.display = "";
    document.getElementById("login-btn").addEventListener("click", triggerLogin);
    return;
  }

  const userLabel = auth.account && (auth.account.username || auth.account.name);
  statusEl.textContent = userLabel ? `${userLabel}(으)로 로그인됨` : "로그인됨";

  document.getElementById("app-content").style.display = "";
  document.getElementById("submit-btn").addEventListener("click", handleSubmit);
}

document.addEventListener("DOMContentLoaded", start);
