# 공동교육과정 시간표 조회 프로그램

정적 웹사이트(HTML/CSS/JS) + Vercel Python 서버리스 함수로 구성된 시간표 조회 프로그램입니다.
빌드 과정 없이 그대로 배포할 수 있습니다. 교사 이름 등 개인정보가 포함되어 있어, **학교
조직의 Microsoft 계정(Entra ID)으로 로그인해야만** 조회할 수 있도록 되어 있습니다.

## 구성

```
public/            ← Vercel이 정적 파일로 서비스하는 유일한 폴더
  index.html, admin.html
  css/, js/
api/                ← 서버리스 함수 (public/ 밖에 있어 직접 URL로 접근 불가)
  _auth.py          MS Entra ID ID 토큰 검증 공용 모듈 (밑줄 접두사라 라우트로 안 잡힘)
  _data/timetable.csv   실제 시간표 데이터 (로그인 검증을 통과해야만 내려줌)
  config.py         프론트엔드에 로그인 설정값(clientId/tenantId) 제공
  timetable.py      로그인 검증 후 시간표 CSV 반환
  holidays.py       공공데이터포털 공휴일 정보 조회
  upload.py         관리자 CSV 업로드 → GitHub 커밋
tests/              위 함수들의 핵심 로직 단위 테스트
requirements.txt    api/ 함수가 필요로 하는 파이썬 패키지 (PyJWT, cryptography)
vercel.json         정적 파일 출력 폴더를 public/ 으로 고정
```

- **조회 페이지** (`public/index.html`): 4가지 방식으로 검색 가능
  - 교사명 (여러 명 동시 선택 → 겹치는 시간대 비교, 선택한 교사는 색으로 구분되는 태그로 표시)
  - 참여학교 (여러 학교 동시 선택 → 겹치는 시간대 비교)
  - 요일·교시 (요일/교시 각각 여러 개 선택, 월~금·1~7교시 순 그리드로 출력)
  - 날짜 (달력에서 날짜 선택 → 공휴일/주말이면 안내, 평일이면 해당 요일 시간표 표시)
- **관리자 페이지** (`public/admin.html`): 로그인 + 비밀번호로 이중 보호된 CSV 업로드 페이지.
  업로드하면 `api/upload.py`가 GitHub API로 `api/_data/timetable.csv`를 저장소에 직접
  커밋하고, Vercel이 자동 재배포합니다 (보통 30초~1분 소요).

## 로그인 보호가 걸리는 이유와 구조

`public/` 폴더만 정적으로 서비스되고 `api/_data/timetable.csv`는 그 밖에 있어 URL로 직접
접근할 수 없습니다. 대신 `public/js/app.js`가 Microsoft Entra ID(MSAL.js)로 로그인해서
발급받은 ID 토큰을 `/api/timetable`에 `Authorization: Bearer ...` 헤더로 보내고,
`api/_auth.py`가 그 토큰이 우리 조직 테넌트에서 우리 앱 앞으로 발급된 것인지 서명까지
검증한 뒤에만 데이터를 반환합니다. **`MS_CLIENT_ID`/`MS_TENANT_ID` 환경변수가 설정되기
전까지는 사이트 자체가 열리지 않습니다** (의도된 동작 — 설정 전에 데이터가 노출되는 것을
막기 위함).

## 로컬에서 미리 보기

Node.js 없이 Python만으로 화면 레이아웃 정도는 확인할 수 있습니다.

```
cd timetable-app
python -m http.server 5173 --directory public
```

다만 로그인·데이터 조회·업로드·공휴일 기능은 모두 서버리스 함수가 필요하므로, 로컬 정적
서버만으로는 "로그인 인증이 설정되지 않았습니다" 화면만 보이고 실제 배포 후에 테스트해야
합니다.

## 배포 절차 (Vercel + GitHub)

1. **GitHub 저장소 생성 후 이 폴더를 push**
   ```
   git init
   git add .
   git commit -m "init: 시간표 조회 프로그램"
   git remote add origin https://github.com/<사용자명>/<저장소명>.git
   git push -u origin main
   ```

2. **GitHub Fine-grained Personal Access Token 발급** (CSV 업로드용)
   GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token
   - Repository access: 위에서 만든 저장소만 선택
   - Permissions: **Contents → Read and write**
   - 생성된 토큰 값을 복사해둡니다 (한 번만 표시됨).

3. **Vercel에서 프로젝트 Import**
   Vercel 대시보드 → Add New → Project → 방금 만든 GitHub 저장소 선택 → Import
   (Framework Preset: Other. `vercel.json`이 출력 폴더를 `public`으로 지정하므로 별도
   빌드 설정 불필요)

4. **Microsoft Entra ID 앱 등록** (학교 조직의 Entra/Azure 관리자 권한 필요)
   - [entra.microsoft.com](https://entra.microsoft.com) (또는 portal.azure.com) →
     Entra ID → **앱 등록** → **새 등록**
   - 이름: 예) `공동교육과정 시간표 조회`
   - 지원되는 계정 유형: **이 조직 디렉터리에만 있는 계정 (단일 테넌트)** ← 반드시 이 옵션
     이어야 외부 계정 로그인을 막을 수 있습니다.
   - 리디렉션 URI: 플랫폼 = **SPA(단일 페이지 애플리케이션)**, URI에 배포될 Vercel 주소
     (예: `https://seoulon-timetable.vercel.app`) 입력. 로컬 테스트도 하려면
     `http://localhost:5173`도 추가.
   - 등록 후 개요 화면에서 **애플리케이션(클라이언트) ID**와 **디렉터리(테넌트) ID**를 복사
   - 클라이언트 시크릿은 필요 없습니다 (SPA는 공개 클라이언트라 시크릿을 쓰지 않음).

5. **Vercel 환경 변수 설정** (Project Settings → Environment Variables, URL로 바로 이동:
   `https://vercel.com/<계정명>/<프로젝트명>/settings/environment-variables`)
   | 이름 | 값 |
   |---|---|
   | `ADMIN_PASSWORD` | 관리자 페이지에서 사용할 비밀번호 |
   | `GITHUB_TOKEN` | 2번에서 발급한 토큰 |
   | `GITHUB_REPO` | `<사용자명>/<저장소명>` |
   | `GITHUB_BRANCH` | `main` (push한 기본 브랜치명) |
   | `HOLIDAY_API_KEY` | 아래 6번에서 발급받은 공휴일 API 서비스키 |
   | `MS_CLIENT_ID` | 4번에서 복사한 애플리케이션(클라이언트) ID |
   | `MS_TENANT_ID` | 4번에서 복사한 디렉터리(테넌트) ID |

   설정 후 Deployments 탭 → 최신 배포 `···` 메뉴 → Redeploy를 눌러 환경 변수를 반영합니다.

6. **공휴일 API 키 발급 (공공데이터포털)**
   - [data.go.kr](https://www.data.go.kr) 회원가입/로그인
   - "한국천문연구원_특일 정보" 데이터셋 검색 → **활용신청** (Open API 방식)
   - 마이페이지 → 활용신청 현황에서 **승인** 상태 확인 (승인 표시 후에도 실제 반영까지
     몇 분~1시간 정도 걸릴 수 있음)
   - 승인 후 마이페이지 → 개발계정 상세보기에서 **일반 인증키(Decoding)** 값을 복사해
     그대로 `HOLIDAY_API_KEY`에 입력 (URL 인코딩된 값이 아니라 디코딩된 원본 값)
   - 키가 없어도 사이트는 정상 동작하며, "날짜로 조회" 탭에서 공휴일 여부만 표시되지 않고
     주말 여부와 요일별 시간표는 그대로 보여줍니다.

7. **배포 확인**
   Vercel이 준 주소로 접속하면 Microsoft 로그인 화면으로 리디렉션됩니다. 학교 조직 계정으로
   로그인 후 정상적으로 조회 페이지가 뜨는지, 조직 외부 계정으로는 로그인이 막히는지
   확인합니다. `/admin.html`에서 로그인 + 비밀번호로 CSV 업로드 테스트도 해봅니다.

## 다음 학기 데이터 갱신

관리자가 `/admin.html`에서 로그인 + 비밀번호 입력 후 새 CSV 파일을 업로드하면, 자동으로
저장소에 커밋되고 Vercel이 재배포합니다. 별도로 코드를 수정하거나 재배포 작업을 할 필요가
없습니다.

CSV 형식은 기존 파일(`api/_data/timetable.csv`)과 동일한 구조(강의실, 교사명, 월1~금7,
시수 컬럼과 각 셀 안에 학교명/과목명/시간이 줄바꿈으로 들어간 형태)를 유지해야 합니다.

다음 학기부터 시작일/종료일이 달라지면 [public/js/app.js](public/js/app.js)의
`SEMESTER_START`, `SEMESTER_END` 상수와 [api/holidays.py](api/holidays.py)의 `YEARS`
목록(공휴일을 조회할 연도)도 함께 수정해서 커밋해야 "날짜로 조회" 탭이 새 학기 기간에
맞게 동작합니다.
