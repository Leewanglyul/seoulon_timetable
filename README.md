# 공동교육과정 시간표 조회 프로그램

정적 웹사이트(HTML/CSS/JS) + Vercel Python 서버리스 함수로 구성된 시간표 조회 프로그램입니다.
빌드 과정 없이 그대로 배포할 수 있습니다.

## 구성

- `index.html`, `css/`, `js/` — 조회 페이지 (교사명 / 파견학교 / 요일·교시 3가지 방식으로 검색)
- `admin.html`, `js/admin.js` — 비밀번호로 보호된 CSV 업로드 페이지
- `data/timetable.csv` — 현재 시간표 데이터 (조회 페이지가 이 파일을 직접 읽음)
- `api/upload.py` — 업로드 요청을 처리하는 서버리스 함수. 비밀번호 확인 후 GitHub API로
  `data/timetable.csv`를 저장소에 직접 커밋합니다. 저장소가 Vercel과 연동되어 있으므로
  커밋되는 즉시 자동 재배포되어 전체 사용자에게 반영됩니다 (보통 30초~1분 소요).
- `tests/test_upload.py` — `api/upload.py`의 핵심 로직에 대한 단위 테스트 (네트워크 없이 검증)

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

4. **Vercel 환경 변수 설정** (Project Settings → Environment Variables)
   | 이름 | 값 |
   |---|---|
   | `ADMIN_PASSWORD` | 관리자 페이지에서 사용할 비밀번호 |
   | `GITHUB_TOKEN` | 2번에서 발급한 토큰 |
   | `GITHUB_REPO` | `<사용자명>/<저장소명>` |
   | `GITHUB_BRANCH` | `main` (push한 기본 브랜치명) |

   설정 후 Deploy(또는 Redeploy)를 눌러 환경 변수를 반영합니다.

5. **배포 확인**
   Vercel이 준 주소(`https://프로젝트명.vercel.app`)로 접속해 조회 페이지가 정상 표시되는지 확인합니다.
   `/admin.html`에서 비밀번호와 CSV 파일로 업로드 테스트를 해봅니다.

## 다음 학기 데이터 갱신

관리자가 `/admin.html`에서 비밀번호 입력 후 새 CSV 파일을 업로드하면, 자동으로 저장소에
커밋되고 Vercel이 재배포합니다. 별도로 코드를 수정하거나 재배포 작업을 할 필요가 없습니다.

CSV 형식은 기존 파일(`data/timetable.csv`)과 동일한 구조(강의실, 교사명, 월1~금7, 시수 컬럼과
각 셀 안에 학교명/과목명/시간이 줄바꿈으로 들어간 형태)를 유지해야 합니다.
