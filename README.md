# 공동교육과정 시간표 조회 프로그램

정적 웹사이트(HTML/CSS/JS) + Vercel Python 서버리스 함수로 구성된 시간표 조회 프로그램입니다.
빌드 과정 없이 그대로 배포할 수 있습니다.

## 구성

- `index.html`, `css/`, `js/` — 조회 페이지. 4가지 방식으로 검색 가능:
  - 교사명 (여러 명 동시 선택 → 겹치는 시간대 비교)
  - 참여학교 (여러 학교 동시 선택 → 겹치는 시간대 비교)
  - 요일·교시 (요일/교시 각각 여러 개 선택, 월~금·1~7교시 순 그리드로 출력)
  - 날짜 (달력에서 날짜 선택 → 공휴일/주말이면 안내, 평일이면 해당 요일 시간표 표시)
- `admin.html`, `js/admin.js` — 비밀번호로 보호된 CSV 업로드 페이지
- `data/timetable.csv` — 현재 시간표 데이터 (조회 페이지가 이 파일을 직접 읽음)
- `api/upload.py` — 업로드 요청을 처리하는 서버리스 함수. 비밀번호 확인 후 GitHub API로
  `data/timetable.csv`를 저장소에 직접 커밋합니다. 저장소가 Vercel과 연동되어 있으므로
  커밋되는 즉시 자동 재배포되어 전체 사용자에게 반영됩니다 (보통 30초~1분 소요).
- `api/holidays.py` — 공공데이터포털 "특일 정보" API를 호출해 공휴일 목록을 반환하는
  서버리스 함수. "날짜로 조회" 탭이 이 API 결과를 사용합니다.
- `tests/test_upload.py`, `tests/test_holidays.py` — 두 서버리스 함수의 핵심 로직에 대한
  단위 테스트 (네트워크 없이 검증)

## 로컬에서 미리 보기

Node.js 없이 Python만으로 조회 페이지를 확인할 수 있습니다.

```
cd timetable-app
python -m http.server 5173
```

브라우저에서 `http://localhost:5173` 접속. (단, `admin.html`의 업로드 기능은 서버리스
함수가 필요하므로 로컬 정적 서버만으로는 동작하지 않고, 실제 배포 후 테스트해야 합니다.)

## 배포 절차 (Vercel + GitHub)

1. **GitHub 저장소 생성 후 이 폴더를 push**
   ```
   git init
   git add .
   git commit -m "init: 시간표 조회 프로그램"
   git remote add origin https://github.com/<사용자명>/<저장소명>.git
   git push -u origin main
   ```

2. **GitHub Fine-grained Personal Access Token 발급**
   GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token
   - Repository access: 위에서 만든 저장소만 선택
   - Permissions: **Contents → Read and write**
   - 생성된 토큰 값을 복사해둡니다 (한 번만 표시됨).

3. **Vercel에서 프로젝트 Import**
   Vercel 대시보드 → Add New → Project → 방금 만든 GitHub 저장소 선택 → Import
   (Framework Preset: Other / 별도 빌드 설정 불필요)

4. **Vercel 환경 변수 설정** (Project Settings → Environment Variables, URL로 바로 이동:
   `https://vercel.com/<계정명>/<프로젝트명>/settings/environment-variables`)
   | 이름 | 값 |
   |---|---|
   | `ADMIN_PASSWORD` | 관리자 페이지에서 사용할 비밀번호 |
   | `GITHUB_TOKEN` | 2번에서 발급한 토큰 |
   | `GITHUB_REPO` | `<사용자명>/<저장소명>` |
   | `GITHUB_BRANCH` | `main` (push한 기본 브랜치명) |
   | `HOLIDAY_API_KEY` | 아래 5-1번에서 발급받은 공휴일 API 서비스키 |

   설정 후 Deployments 탭 → 최신 배포 `···` 메뉴 → Redeploy를 눌러 환경 변수를 반영합니다.

5-1. **공휴일 API 키 발급 (공공데이터포털)**
   - [data.go.kr](https://www.data.go.kr) 회원가입/로그인
   - "한국천문연구원_특일 정보" 데이터셋 검색 → **활용신청** (Open API 방식, 보통 즉시 승인)
   - 승인 후 마이페이지 → 개발계정 상세보기에서 **일반 인증키(Decoding)** 값을 복사
   - 이 값을 그대로 `HOLIDAY_API_KEY`에 입력 (URL 인코딩된 인증키가 아니라 디코딩된 원본 값)
   - 키가 없어도 사이트는 정상 동작하며, "날짜로 조회" 탭에서 공휴일 여부만 표시되지 않고
     주말 여부와 요일별 시간표는 그대로 보여줍니다.

5. **배포 확인**
   Vercel이 준 주소(`https://프로젝트명.vercel.app`)로 접속해 조회 페이지가 정상 표시되는지 확인합니다.
   `/admin.html`에서 비밀번호와 CSV 파일로 업로드 테스트를 해봅니다.

## 다음 학기 데이터 갱신

관리자가 `/admin.html`에서 비밀번호 입력 후 새 CSV 파일을 업로드하면, 자동으로 저장소에
커밋되고 Vercel이 재배포합니다. 별도로 코드를 수정하거나 재배포 작업을 할 필요가 없습니다.

CSV 형식은 기존 파일(`data/timetable.csv`)과 동일한 구조(강의실, 교사명, 월1~금7, 시수 컬럼과
각 셀 안에 학교명/과목명/시간이 줄바꿈으로 들어간 형태)를 유지해야 합니다.

다음 학기부터 시작일/종료일이 달라지면 [js/app.js](js/app.js)의 `SEMESTER_START`,
`SEMESTER_END` 상수와 [api/holidays.py](api/holidays.py)의 `YEARS` 목록(공휴일을 조회할
연도)도 함께 수정해서 커밋해야 "날짜로 조회" 탭이 새 학기 기간에 맞게 동작합니다.
