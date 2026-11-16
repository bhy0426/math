# 현재 파일·함수 안내서

라우터는 요청을 받아 응답하고, 같은 폴더의 서비스 함수가 요청한 기능을 수행한다. [인수인계서](HANDOFF.md)와 [구조 지도](architecture.md)에서 전체 폴더 구성을 볼 수 있다.

## 회원가입 코드를 읽는 순서

1. 이메일이 켜졌을 때와 꺼졌을 때 어떤 화면을 보여 주는지 [RegisterPage.jsx](../client/src/pages/RegisterPage.jsx)에서 본다.
2. 이메일 방식은 [인증 라우터](../src/modules/auth/routes.js) → [이메일 가입 서비스](../src/modules/auth/register.service.js) 순서로 읽는다. 메일을 보내는 함수는 [mail.js](../src/modules/auth/mail.js), 검증에 사용하는 SignupCode와 회원 User의 테이블 정의는 [models.js](../src/models.js)에 있다.
3. 카카오·구글 방식은 [카카오 라우터](../src/modules/auth/kakao.routes.js) 또는 [구글 라우터](../src/modules/auth/google.routes.js)에서 시작한다. 두 라우터가 함께 쓰는 [소셜 인증 서비스](../src/modules/auth/social.service.js)에서 신규 회원과 기존 회원의 처리 차이를 확인한다.
4. 두 방식 모두 학생 상태를 pending으로 저장한다. 승인 상태를 바꾸는 요청과 응답 예시는 [API 목록](API.md)에서 확인한다.

## 파일 목록

- [.editorconfig](#file-1) — 편집기 공통 들여쓰기 규칙
- [.env.example](#file-2) — 비공개 설정에 어떤 항목이 필요한지 보여주는 양식
- [.gitattributes](#file-3) — Git의 텍스트 줄바꿈 규칙
- [.gitignore](#file-4) — Git에 올리지 않을 파일 지정
- [.prettierignore](#file-5) — Prettier가 정렬하지 않을 파일
- [.prettierrc.json](#file-6) — Prettier 코드 정렬 규칙
- [.vscode/settings.json](#file-7) — VS Code의 들여쓰기·표시 기본값
- [README.md](#file-8) — 실행·설정·테스트 기본 안내
- [client/index.html](#file-9) — React가 들어갈 빈 HTML 틀
- [client/src/App.jsx](#file-10) — 화면 주소와 페이지를 연결
- [client/src/main.jsx](#file-11) — React 화면의 실행 시작점
- [client/src/pages/BoardsPage.jsx](#file-12) — 공지 목록·본문·관리자 작성 화면
- [client/src/pages/CoursesPage.jsx](#file-13) — 강좌 목록과 강좌 상세를 한 컴포넌트로 표시
- [client/src/pages/InfoPage.jsx](#file-14) — 소개와 질문·답변 화면
- [client/src/pages/LecturePage.jsx](#file-15) — 허용된 강의 영상 시청
- [client/src/pages/LoginPage.jsx](#file-16) — 아이디·이메일 또는 연결된 소셜 계정으로 로그인
- [client/src/pages/ProfilePage.jsx](#file-17) — 활성 회원 항목 수정과 카카오·구글 계정 연결
- [client/src/pages/RegisterPage.jsx](#file-18) — 관리자의 이메일 설정에 따른 이메일·소셜 가입 화면
- [client/src/pages/ResetPage.jsx](#file-19) — 연결된 소셜 계정 또는 관리자 발송 메일로 비밀번호 변경
- [client/src/pages/manager/CourseManager.jsx](#file-20) — 강좌 선택·등록·수정·삭제
- [client/src/pages/manager/LectureManager.jsx](#file-21) — 영상 등록·수정·변환 상태
- [client/src/pages/manager/ManagerPage.jsx](#file-22) — 회원·역할·강좌·영상 관리 화면 조립
- [client/src/pages/manager/MemberManager.jsx](#file-23) — 회원·시청 권한·관리자 초기화 UI
- [client/src/pages/manager/MemberSettings.jsx](#file-24) — 회원정보 항목 ON/OFF 화면
- [client/src/pages/manager/RoleManager.jsx](#file-25) — 역할 분류 CRUD
- [client/src/shared/MemberFields.jsx](#file-26) — 가입·본인 수정·관리자 수정의 공통 입력
- [client/src/shared/PopupNotice.jsx](#file-27) — 공지 팝업·오늘 숨김
- [client/src/shared/VideoPlayer.jsx](#file-28) — 원본·HLS 영상 플레이어
- [client/src/shared/api.js](#file-29) — 브라우저에서 서버에 요청하는 공통 함수
- [client/src/shared/auth.jsx](#file-30) — React 전체의 로그인 상태와 화면 접근 검사
- [client/src/shared/components.jsx](#file-31) — 공통 레이아웃·폼·확인 버튼
- [client/src/shared/hooks.js](#file-32) — 조회·변경 요청 상태 공유
- [client/src/shared/memberLabel.mjs](#file-33) — 화면에 표시할 회원 식별 정보
- [client/src/style.css](#file-34) — 기본 메뉴·입력 폼·영상 크기 서식
- [database/certs/filess-ca.pem](#file-35) — 온라인 MySQL TLS 검증용 공개 CA 인증서
- [database/migrate.js](#file-36) — 매핑 기반 기존 DB 열·닉네임 중복 검사·인덱스 준비
- [docs/API.md](#file-37) — 설명 문서
- [docs/HANDOFF.md](#file-38) — 설명 문서
- [docs/architecture.md](#file-39) — 설명 문서
- [docs/code-map.md](#file-40) — 폴더 구조와 코드 읽는 순서
- [docs/functions.md](#file-41) — 현재 파일·함수 설명 전체 목록
- [docs/kakao-setup.md](#file-42) — 카카오 개발자 앱과 로컬 설정 방법
- [docs/requirements-status.md](#file-43) — 설명 문서
- [docs/social-login.md](#file-44) — 설명 문서
- [package-lock.json](#file-45) — 설치할 라이브러리 버전 고정
- [package.json](#file-46) — 프로젝트 실행 명령·라이브러리 목록
- [scripts/init-db.js](#file-47) — ORM 스키마·기본 역할·최초 관리자 준비
- [scripts/local-db.js](#file-48) — 전용 로컬 MySQL 시작·정상 종료
- [scripts/nginx.js](#file-49) — 전용 Nginx 설정·시작·중지
- [server/nginx.conf.template](#file-50) — 설정·자료
- [src/app.js](#file-51) — Express 앱과 공통 처리 순서·API 라우터 연결
- [src/database.js](#file-52) — Sequelize MySQL 연결·TLS·최대 1개 풀 설정
- [src/frontend.js](#file-53) — Express에서 React 실행·빌드 결과를 제공
- [src/health.js](#file-54) — 서버·DB 상태 조회 기능
- [src/middleware/session-user.js](#file-55) — 세션을 사용자 정보로 바꾸고 요청 출처 확인
- [src/models.js](#file-56) — Sequelize 테이블 매핑·고유 제약·모델 관계 및 이메일 가입 인증코드 보관
- [src/modules/auth/account.js](#file-57) — 회원·역할 관계 조회와 응답용 회원 정보
- [src/modules/auth/google.client.js](#file-58) — 구글 인증 서버 통신
- [src/modules/auth/google.config.js](#file-59) — 서버 환경 변수의 Google OAuth 설정 검증
- [src/modules/auth/google.repository.js](#file-60) — 구글 고유 식별자와 MathSite 회원의 ORM 연결
- [src/modules/auth/google.routes.js](#file-61) — 요청·응답 라우터
- [src/modules/auth/google.service.js](#file-62) — 구글 공통 인증 서비스 구성
- [src/modules/auth/kakao.client.js](#file-63) — 카카오 서버와 HTTP 통신
- [src/modules/auth/kakao.config.js](#file-64) — 카카오 설정 읽기·검사
- [src/modules/auth/kakao.repository.js](#file-65) — 카카오 계정과 우리 회원의 ORM 관계 저장
- [src/modules/auth/kakao.routes.js](#file-66) — 카카오 인증 URL과 controller 연결
- [src/modules/auth/kakao.service.js](#file-67) — 카카오 공통 인증 서비스 구성
- [src/modules/auth/mail.js](#file-68) — 회원가입 인증코드와 관리자 비밀번호 초기화 메일 발송
- [src/modules/auth/password.js](#file-69) — 반복 PBKDF2 저장과 이전 scrypt 검증
- [src/modules/auth/register.service.js](#file-70) — 이메일 코드 발송과 검증을 거친 승인 대기 회원 생성
- [src/modules/auth/routes.js](#file-71) — 인증 요청·응답과 인증 서비스 연결
- [src/modules/auth/service.js](#file-72) — 로그인·로그아웃·비밀번호 복구와 관리자 초기화
- [src/modules/auth/session.js](#file-73) — 로그인 세션 저장·재생성
- [src/modules/auth/social.service.js](#file-74) — 구글·카카오 공통 로그인·연결·비밀번호 복구 흐름
- [src/modules/boards/routes.js](#file-75) — 공지 목록·상세·관리자 작성 API
- [src/modules/boards/service.js](#file-76) — 공지·팝업·고정 기능
- [src/modules/courses/access.js](#file-77) — 강좌·강의 소속과 현재 시청 권한
- [src/modules/courses/lectures.routes.js](#file-78) — 강좌에 속한 영상 업로드·시청 API
- [src/modules/courses/lectures.service.js](#file-79) — 강의 CRUD·재생·스트림 정보 기능
- [src/modules/courses/routes.js](#file-80) — 강좌 묶음 조회·검색·관리 API
- [src/modules/courses/service.js](#file-81) — 강좌 CRUD·검색 기능
- [src/modules/courses/upload.js](#file-82) — Multer 업로드·영상 서명 검증
- [src/modules/courses/video.js](#file-83) — FFmpeg 변환 큐·모델 상태 갱신·취소·복구
- [src/modules/info/routes.js](#file-84) — 질문·답변 API
- [src/modules/info/service.js](#file-85) — 질문·비공개·작성자·관리자 답변 기능
- [src/modules/manager/member-fields.service.js](#file-86) — 가입·프로필·관리자 수정·응답의 공통 회원 항목 정책
- [src/modules/manager/routes.js](#file-87) — 관리자 전용 회원·역할·시청 권한 관리 API
- [src/modules/manager/service.js](#file-88) — 관리자 회원·역할·시청 권한 기능
- [src/modules/user/routes.js](#file-89) — 로그인한 본인의 회원 정보 API
- [src/modules/user/service.js](#file-90) — 본인 프로필 변경
- [src/server.js](#file-91) — DB 확인 후 HTTP 서버 실행
- [src/shared/helpers.js](#file-92) — 입력 검증·HTTP 접근 미들웨어·원본 파일 공통 처리
- [tests/api.test.js](#file-93) — Mocha로 API와 권한의 실제 동작 검사
- [tests/database-env.js](#file-94) — 테스트가 공유 온라인 DB를 건드리지 못하게 설정
- [tests/features.test.js](#file-95) — ORM·유일성·반복 해시·관리자 초기화·영상 통합 검사
- [tests/fixtures/sample.mp4](#file-96) — 업로드·부분 재생 검사에 쓰는 짧은 영상
- [tests/http-client.js](#file-97) — Mocha 테스트용 HTTP 요청 함수 생성
- [tests/kakao.test.js](#file-98) — Mocha로 카카오 인증 흐름 검사
- [tests/reset-data.js](#file-99) — 시험 전용 모델 자료 정리
- [tests/seed.js](#file-100) — 합성 ORM 시험 자료 준비
- [tests/signup-mail.js](#file-101) — 격리 테스트에서 가입 인증 메일을 읽는 도우미
- [tests/social.test.js](#file-102) — 구글·카카오 복구·동적 회원 항목 통합 검사
- [vite.config.mjs](#file-103) — React 개발·빌드 설정

<a id="file-1"></a>

## .editorconfig

역할: 편집기 공통 들여쓰기 규칙

[실제 파일](../.editorconfig)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-2"></a>

## .env.example

역할: 비공개 설정에 어떤 항목이 필요한지 보여주는 양식

[실제 파일](../.env.example)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-3"></a>

## .gitattributes

역할: Git의 텍스트 줄바꿈 규칙

[실제 파일](../.gitattributes)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-4"></a>

## .gitignore

역할: Git에 올리지 않을 파일 지정

[실제 파일](../.gitignore)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-5"></a>

## .prettierignore

역할: Prettier가 정렬하지 않을 파일

[실제 파일](../.prettierignore)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-6"></a>

## .prettierrc.json

역할: Prettier 코드 정렬 규칙

[실제 파일](../.prettierrc.json)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-7"></a>

## .vscode/settings.json

역할: VS Code의 들여쓰기·표시 기본값

[실제 파일](../.vscode/settings.json)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-8"></a>

## README.md

역할: 실행·설정·테스트 기본 안내

[실제 파일](../README.md)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-9"></a>

## client/index.html

역할: React가 들어갈 빈 HTML 틀

[실제 파일](../client/index.html)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-10"></a>

## client/src/App.jsx

역할: 화면 주소와 페이지를 연결

[실제 파일](../client/src/App.jsx)

### App

원본 14행.

입력 없음 → Layout 안에 Routes를 배치하고 path에 맞는 페이지 컴포넌트를 선택 → 화면(JSX)을 반환한다. /manager는 RequireUser admin으로 감싼다.

<a id="file-11"></a>

## client/src/main.jsx

역할: React 화면의 실행 시작점

[실제 파일](../client/src/main.jsx)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-12"></a>

## client/src/pages/BoardsPage.jsx

역할: 공지 목록·본문·관리자 작성 화면

[실제 파일](../client/src/pages/BoardsPage.jsx)

### BoardsPage

원본 7행.

로그인한 user와 선택한 공지 ID를 사용 → useResource로 목록·상세 조회 → 공지 화면 반환. 저장 콜백은 선택 여부에 따라 POST/PATCH, 삭제 콜백은 DELETE /api/boards/:boardId를 호출한다.

### reset

원본 15행.

입력 없음 → 선택 ID를 비우고 draftKey를 증가시켜 새 입력 폼으로 교체, list.reload() 호출 → 새 공지 작성 상태로 돌아간다.

<a id="file-13"></a>

## client/src/pages/CoursesPage.jsx

역할: 강좌 목록과 강좌 상세를 한 컴포넌트로 표시

[실제 파일](../client/src/pages/CoursesPage.jsx)

### CoursesPage

원본 6행.

props 없음. useParams로 주소의 courseId를 읽는다 → ID가 없으면 검색한 강좌 목록을, 있으면 강좌 정보와 강의 목록을 GET 조회 → 링크 목록을 반환한다. 검색 폼 콜백은 search 상태를 변경해 재조회한다.

<a id="file-14"></a>

## client/src/pages/InfoPage.jsx

역할: 소개와 질문·답변 화면

[실제 파일](../client/src/pages/InfoPage.jsx)

### InfoPage

원본 8행.

학원 소개와 로그인 여부에 따른 Questions를 표시한다. 공식 채팅 링크는 없다.

### Questions

원본 25행.

질문 목록·본문과 작성자 수정·삭제·관리자 답변을 API에 연결한다.

### reset

원본 33행.

질문 선택과 폼을 초기화하고 목록을 재조회한다.

<a id="file-15"></a>

## client/src/pages/LecturePage.jsx

역할: 허용된 강의 영상 시청

[실제 파일](../client/src/pages/LecturePage.jsx)

### LecturePage

원본 7행.

주소의 courseId, lectureId를 읽는다 → useEffect에서 POST /api/courses/:courseId/lectures/:lectureId/playback 요청 → 응답의 playbackUrl을 <video src>에 넣은 화면을 반환한다. 영상 요청 때도 서버가 권한을 다시 확인한다.

<a id="file-16"></a>

## client/src/pages/LoginPage.jsx

역할: 아이디·이메일 또는 연결된 소셜 계정으로 로그인

[실제 파일](../client/src/pages/LoginPage.jsx)

### LoginPage

원본 7행.

로그인 식별자 라벨과 소셜 로그인·비밀번호 찾기를 현재 사용 가능한 기능에 맞춰 보여 준다.

<a id="file-17"></a>

## client/src/pages/ProfilePage.jsx

역할: 활성 회원 항목 수정과 카카오·구글 계정 연결

[실제 파일](../client/src/pages/ProfilePage.jsx)

### ProfilePage

원본 7행.

현재 사용 항목만 수정하고 카카오·구글 연결을 제공한다.

<a id="file-18"></a>

## client/src/pages/RegisterPage.jsx

역할: 관리자의 이메일 설정에 따른 이메일·소셜 가입 화면

[실제 파일](../client/src/pages/RegisterPage.jsx)

### EmailRegistration

원본 9행.

회원정보와 비밀번호 입력 후 이메일 코드 발송 단계에서 검증 단계로 바꾼다. 수신 주소와 입력 기한, 재발송·정보 수정 버튼을 표시한다.

### sendCode

원본 14행.

비밀번호를 제외한 가입 정보로 코드 발송을 요청한다. 서버가 보낸 만료·재발송 시간을 저장하고 기존 코드 입력란을 비운다.

### submit

원본 20행.

비밀번호 확인이 일치하는지 검사한다. 처음에는 코드를 발송하고, 입력한 뒤에는 활성 회원 항목·비밀번호·코드를 서버로 보내 가입을 신청한다.

### SocialRegistration

원본 99행.

카카오·구글의 상태를 조회해서 설정된 가입 수단을 표시한다. 서버가 인증 세션을 확인한 공급자에 한해 추가 정보를 받아 가입을 신청한다.

### RegisterPage

원본 148행.

이메일을 켰으면 이메일 가입 폼을, 껐으면 소셜 가입 화면을 표시한다. 가입이 완료되면 서버의 승인 대기 안내를 보여 준다.

<a id="file-19"></a>

## client/src/pages/ResetPage.jsx

역할: 연결된 소셜 계정 또는 관리자 발송 메일로 비밀번호 변경

[실제 파일](../client/src/pages/ResetPage.jsx)

### ResetPage

원본 8행.

사용 가능한 소셜 인증과 메일 안내만 보여 주고, 허용된 메일 토큰 또는 소셜 복구 세션으로 비밀번호를 변경한다.

<a id="file-20"></a>

## client/src/pages/manager/CourseManager.jsx

역할: 강좌 선택·등록·수정·삭제

[실제 파일](../client/src/pages/manager/CourseManager.jsx)

### CourseManager

원본 5행.

courses, course, onSelect, onChange를 받는다 → 강좌 선택과 입력 폼 반환. 제출 콜백은 누른 버튼의 action을 읽어 POST /api/courses 또는 PATCH /api/courses/:id, 삭제 콜백은 DELETE 후 선택 해제·목록 재조회를 한다.

<a id="file-21"></a>

## client/src/pages/manager/LectureManager.jsx

역할: 영상 등록·수정·변환 상태

[실제 파일](../client/src/pages/manager/LectureManager.jsx)

### LectureManager

원본 6행.

등록·수정·공개·삭제·변환 재시도 화면을 그린다.

### save

원본 9행.

파일과 필드를 FormData로 저장하고 공개 상태를 명시한다. 저장 후 목록을 재조회한다.

### LectureFields

원본 93행.

강의 제목·선택 설명·순서·파일·공개 여부 입력을 반환한다.

<a id="file-22"></a>

## client/src/pages/manager/ManagerPage.jsx

역할: 회원·역할·강좌·영상 관리 화면 조립

[실제 파일](../client/src/pages/manager/ManagerPage.jsx)

### ManagerPage

원본 11행.

회원·강좌 상단 탭을 표시한다. 회원 탭은 항목·프로필·역할·시청권한, 강좌 탭은 강좌 및 그 하위 강의 관리로 구분한다.

<a id="file-23"></a>

## client/src/pages/manager/MemberManager.jsx

역할: 회원·시청 권한·관리자 초기화 UI

[실제 파일](../client/src/pages/manager/MemberManager.jsx)

### MemberManager

원본 10행.

회원 표시를 memberLabel에 위임한다. 회원별 정보 수정·역할·삭제·상태·시청 권한과 관리자 초기화 메일 버튼을 제공한다.

### changeStatus

원본 23행.

회원 승인·정지 API 완료 후 목록을 재조회한다.

### access

원본 30행.

허용/회수·대상 강의·선택 만료일을 API에 전달하고 현재 권한 목록을 갱신한다.

<a id="file-24"></a>

## client/src/pages/manager/MemberSettings.jsx

역할: 회원정보 항목 ON/OFF 화면

[실제 파일](../client/src/pages/manager/MemberSettings.jsx)

### MemberSettings

원본 6행.

관리자 전용 정책에서 전체 스위치를 읽는다. 저장에 실패하면 되돌리고, 성공한 경우 후속 조회 실패를 구분해 표시한다.

<a id="file-25"></a>

## client/src/pages/manager/RoleManager.jsx

역할: 역할 분류 CRUD

[실제 파일](../client/src/pages/manager/RoleManager.jsx)

### RoleManager

원본 5행.

역할 목록과 이름 수정·일반 역할 생성·삭제 폼을 그린다. 회원 nickname과 역할 name은 서로 다른 필드다.

### save

원본 7행.

역할 API로 변경을 전송하고 상위 목록을 재조회한다.

<a id="file-26"></a>

## client/src/shared/MemberFields.jsx

역할: 가입·본인 수정·관리자 수정의 공통 입력

[실제 파일](../client/src/shared/MemberFields.jsx)

### profileChanges

원본 4행.

본인·관리자 수정 폼에서 실제로 값이 바뀐 회원 항목만 추린다.

### MemberFields

원본 9행.

AuthContext의 현재 항목 설정 중 켜 둔 정보만 같은 형식·이름으로 렌더링한다.

<a id="file-27"></a>

## client/src/shared/PopupNotice.jsx

역할: 공지 팝업·오늘 숨김

[실제 파일](../client/src/shared/PopupNotice.jsx)

### PopupNotice

원본 4행.

팝업 공지를 조회해 오늘 숨김 기록이 없으면 dialog를 연다.

### close

원본 21행.

현재 방문 또는 오늘의 숨김 상태를 기록하고 팝업을 닫는다.

<a id="file-28"></a>

## client/src/shared/VideoPlayer.jsx

역할: 원본·HLS 영상 플레이어

[실제 파일](../client/src/shared/VideoPlayer.jsx)

### VideoPlayer

원본 4행.

브라우저 기본 재생 또는 HLS.js를 연결한다. 치명적 오류는 표시하고 화면 전환 시 플레이어를 정리한다.

<a id="file-29"></a>

## client/src/shared/api.js

역할: 브라우저에서 서버에 요청하는 공통 함수

[실제 파일](../client/src/shared/api.js)

### api

원본 2행.

method(요청 방식), path(API 주소), body(보낼 값)를 받는다 → fetch로 요청하고 응답을 JSON으로 읽는다 → 성공하면 응답 객체를 반환하고 실패하면 Error를 던진다. FormData는 파일을 포함하므로 JSON으로 바꾸지 않는다.

<a id="file-30"></a>

## client/src/shared/auth.jsx

역할: React 전체의 로그인 상태와 화면 접근 검사

[실제 파일](../client/src/shared/auth.jsx)

### useAuth

원본 6행.

입력 없음 → useContext(AuthContext) → 현재 user, setUser, loading, error를 가져온다.

### AuthProvider

원본 8행.

화면 이동 시 로그인 상태와 회원 항목 설정을 읽어 user·fields·reloadAuth·loading·error를 공유한다.

### reloadAuth

원본 17행.

저장 응답으로 받은 항목 설정을 즉시 적용하고 로그인 상태를 갱신한다. 저장 응답이 없으면 항목도 조회하고, 이전 요청의 늦은 결과는 무시한다.

### refresh

원본 49행.

화면이 바뀌거나 다시 보이면 로그인과 항목 정책을 조회하고 로딩·오류 상태를 반영한다.

### onVisibilityChange

원본 54행.

백그라운드에 있던 탭이 보이면 상태를 다시 확인한다.

### RequireUser

원본 86행.

admin(기본 false), children을 받는다 → 조회 중/오류/비로그인/관리자 여부를 확인 → 허용하면 children, 비로그인이면 로그인 화면 이동, 일반 계정의 관리자 접근이면 안내 문구를 반환한다.

<a id="file-31"></a>

## client/src/shared/components.jsx

역할: 공통 레이아웃·폼·확인 버튼

[실제 파일](../client/src/shared/components.jsx)

### Layout

원본 9행.

상단 메뉴에 현재 켜 둔 회원 항목과 역할을 반영하고 로그인 사용자의 팝업을 표시한다.

### Page

원본 53행.

페이지 제목·결과 문구·children을 반환한다.

### Field

원본 66행.

label과 input/select/textarea 속성을 조립한다.

### Form

원본 75행.

기본 새로고침을 막고 FormData·폼 요소를 onSubmit에 전달한다.

### DeleteButton

원본 90행.

첫 클릭은 confirmLabel을 표시하고 두 번째 클릭에서 onDelete를 수행한다. 관리자 초기화도 해당 확인 동작을 사용한다.

<a id="file-32"></a>

## client/src/shared/hooks.js

역할: 조회·변경 요청 상태 공유

[실제 파일](../client/src/shared/hooks.js)

### useResource

원본 5행.

URL이 있으면 GET으로 조회해 data·error·reload를 반환하고 이전 화면의 늦은 응답을 무시한다.

### reload

원본 8행.

조회 revision을 올려 같은 URL을 다시 읽는다.

### useAction

원본 43행.

변경 요청의 busy·message·run을 제공한다.

### run

원본 46행.

전달된 작업을 실행해 처리 중·오류·성공 문구를 관리한다.

<a id="file-33"></a>

## client/src/shared/memberLabel.mjs

역할: 화면에 표시할 회원 식별 정보

[실제 파일](../client/src/shared/memberLabel.mjs)

### memberLabel

원본 1행.

사용 중인 항목에서 닉네임, 아이디, 이메일 순서로 값이 있는 항목을 찾는다. 모두 비어 있으면 회원 번호를 반환한다.

<a id="file-34"></a>

## client/src/style.css

역할: 기본 메뉴·입력 폼·영상 크기 서식

[실제 파일](../client/src/style.css)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-35"></a>

## database/certs/filess-ca.pem

역할: 온라인 MySQL TLS 검증용 공개 CA 인증서

[실제 파일](../database/certs/filess-ca.pem)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-36"></a>

## database/migrate.js

역할: 매핑 기반 기존 DB 열·닉네임 중복 검사·인덱스 준비

[실제 파일](../database/migrate.js)

### migrate

원본 4행.

QueryInterface로 기존 테이블과 열을 조사한다. 없는 열을 추가하고 구형 signup_codes.sent_at에 NULL을 허용해 첫 가입 코드 발송을 준비한다. 기존 중복 닉네임이 있어도 나머지 테이블을 준비하고, 중복이 없을 때 회원 닉네임 고유 인덱스를 추가한다. 기존 영상 상태를 보정하고 보류 그룹 수를 반환한다.

<a id="file-37"></a>

## docs/API.md

역할: 설명 문서

[실제 파일](../docs/API.md)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-38"></a>

## docs/HANDOFF.md

역할: 설명 문서

[실제 파일](../docs/HANDOFF.md)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-39"></a>

## docs/architecture.md

역할: 설명 문서

[실제 파일](../docs/architecture.md)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-40"></a>

## docs/code-map.md

역할: 폴더 구조와 코드 읽는 순서

[실제 파일](../docs/code-map.md)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-41"></a>

## docs/functions.md

역할: 현재 파일·함수 설명 전체 목록

[실제 파일](../docs/functions.md)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-42"></a>

## docs/kakao-setup.md

역할: 카카오 개발자 앱과 로컬 설정 방법

[실제 파일](../docs/kakao-setup.md)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-43"></a>

## docs/requirements-status.md

역할: 설명 문서

[실제 파일](../docs/requirements-status.md)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-44"></a>

## docs/social-login.md

역할: 설명 문서

[실제 파일](../docs/social-login.md)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-45"></a>

## package-lock.json

역할: 설치할 라이브러리 버전 고정

[실제 파일](../package-lock.json)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-46"></a>

## package.json

역할: 프로젝트 실행 명령·라이브러리 목록

[실제 파일](../package.json)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-47"></a>

## scripts/init-db.js

역할: ORM 스키마·기본 역할·최초 관리자 준비

[실제 파일](../scripts/init-db.js)

### initialize

원본 6행.

migrate 후 기본 관리자·학생 역할을 findOrCreate한다. 기존 회원·강좌를 지우지 않는다.

### createInitialAdmin

원본 20행.

회원이 없는 DB에서만 환경 변수의 관리자 닉네임·아이디·이메일·반복 해시를 저장한다.

<a id="file-48"></a>

## scripts/local-db.js

역할: 전용 로컬 MySQL 시작·정상 종료

[실제 파일](../scripts/local-db.js)

### connect

원본 12행.

로컬 전용 Sequelize 연결을 인증하고 닫아 MySQL 실행 여부를 확인한다.

### stop

원본 33행.

비공개 관리 설정으로 mysqladmin을 실행한다. datadir가 MathSite 전용인지 검증한 뒤 정상 종료하고 임시 설정 파일을 제거한다.

### main

원본 63행.

start/stop 명령을 구분한다. 시작은 연결 확인·필요한 mysqld 실행·준비 대기를 수행한다.

<a id="file-49"></a>

## scripts/nginx.js

역할: 전용 Nginx 설정·시작·중지

[실제 파일](../scripts/nginx.js)

### running

원본 15행.

전용 PID 파일의 프로세스가 실행 중인지 확인한다.

### configure

원본 26행.

포트·저장 경로를 검증해 템플릿을 생성하고 Nginx 설정 검사를 실행한다.

<a id="file-50"></a>

## server/nginx.conf.template

역할: 설정·자료

[실제 파일](../server/nginx.conf.template)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-51"></a>

## src/app.js

역할: Express 앱과 공통 처리 순서·API 라우터 연결

[실제 파일](../src/app.js)

### 공통 HTTP 처리 1

원본 11행.

요청 body·응답 헤더·404 또는 오류 응답을 공통으로 처리한다.

### dbBusy

원본 25행.

DB 동시 연결 한도로 대기할 때 503과 재시도 시간을 응답한다.

### 공통 HTTP 처리 2

원본 37행.

요청 body·응답 헤더·404 또는 오류 응답을 공통으로 처리한다.

### GET /health

원본 44행.

req, res를 받는다 → SELECT 1로 DB를 확인 → 서버 상태·현재 로그인 사용자·API 주소를 JSON으로 응답한다.

### 공통 HTTP 처리 3

원본 58행.

요청 body·응답 헤더·404 또는 오류 응답을 공통으로 처리한다.

### 공통 HTTP 처리 4

원본 61행.

요청 body·응답 헤더·404 또는 오류 응답을 공통으로 처리한다.

### 공통 HTTP 처리 5

원본 63행.

요청 body·응답 헤더·404 또는 오류 응답을 공통으로 처리한다.

<a id="file-52"></a>

## src/database.js

역할: Sequelize MySQL 연결·TLS·최대 1개 풀 설정

[실제 파일](../src/database.js)

### isConnectionLimit

원본 33행.

MySQL 오류 중 계정 동시 연결 한도 초과를 구별한다.

<a id="file-53"></a>

## src/frontend.js

역할: Express에서 React 실행·빌드 결과를 제공

[실제 파일](../src/frontend.js)

### 공통 HTTP 처리 1

원본 11행.

요청 body·응답 헤더·404 또는 오류 응답을 공통으로 처리한다.

### GET [화면 주소들]

원본 14행.

화면 주소로 GET 요청 → 개발은 index.html을 Vite로 변환, 일반 실행은 빌드된 index.html 전송 → React가 이후 App.jsx에서 화면을 선택한다.

### configureFrontend

원본 41행.

HTTP server와 development 여부를 받는다 → 개발 모드면 Vite 서버를 만들고 같은 HTTP 서버에 HMR을 연결 → 설정 완료. 일반 실행이면 바로 반환한다. 서버 close 콜백은 Vite를 닫는다.

<a id="file-54"></a>

## src/health.js

역할: 서버·DB 상태 조회 기능

[실제 파일](../src/health.js)

### status

원본 3행.

Sequelize authenticate로 DB 접속을 확인하고 상태·로그인 정보·주요 API 주소를 반환한다.

<a id="file-55"></a>

## src/middleware/session-user.js

역할: 세션을 사용자 정보로 바꾸고 요청 출처 확인

[실제 파일](../src/middleware/session-user.js)

### currentUser

원본 4행.

req, res, next를 받는다 → 세션의 userId로 DB를 조회하고 active·session_version 일치 검사 → 유효하면 req.user 저장, 무효면 세션 재생성·쿠키 제거 후 next(). 매 요청 최신 정지·역할 변경을 반영한다.

### sameOrigin

원본 16행.

req, res, next를 받는다 → 변경 요청에 Origin 헤더가 있으면 현재 host·protocol과 비교 → 다르면 403, 같거나 검사 대상이 아니면 next(). Origin이 없는 요청을 무조건 거절하는 구현은 아니다.

<a id="file-56"></a>

## src/models.js

역할: Sequelize 테이블 매핑·고유 제약·모델 관계 및 이메일 가입 인증코드 보관

[실제 파일](../src/models.js)

### primaryId

원본 4행.

자동 증가 양의 정수 기본키 속성을 만들어 모델 정의에 전달한다.

### required

원본 9행.

DataType을 받아 필수 열 allowNull:false 속성을 만든다.

### createdAt

원본 10행.

생성 시각의 DATE 매핑을 반환한다.

### define

원본 11행.

테이블 이름·열 매핑·옵션으로 Sequelize 모델을 정의한다. 자동 복수형과 자동 timestamps를 끈다.

<a id="file-57"></a>

## src/modules/auth/account.js

역할: 회원·역할 관계 조회와 응답용 회원 정보

[실제 파일](../src/modules/auth/account.js)

### findUser

원본 5행.

User와 roleRecord 관계를 include하여 ID로 회원을 조회한다.

### publicUser

원본 9행.

현재 회원 항목 설정을 읽어 켜 둔 정보와 내부 ID·상태·역할만 반환한다. 해시·세션 버전·꺼 둔 정보는 응답하지 않는다.

<a id="file-58"></a>

## src/modules/auth/google.client.js

역할: 구글 인증 서버 통신

[실제 파일](../src/modules/auth/google.client.js)

### authorizationUrl

원본 4행.

openid scope·state·PKCE S256·계정 선택 옵션으로 Google 인증 주소를 만든다.

### googleRequest

원본 19행.

고정된 Google HTTPS API에 시간 제한을 두고 요청한다. 오류 원문·토큰을 노출하지 않는다.

### exchangeCode

원본 33행.

서버에서 코드·PKCE verifier를 토큰으로 교환하고 userinfo의 sub를 받아 검증한다. 이메일로 회원을 찾지 않는다.

<a id="file-59"></a>

## src/modules/auth/google.config.js

역할: 서버 환경 변수의 Google OAuth 설정 검증

[실제 파일](../src/modules/auth/google.config.js)

### googleConfig

원본 3행.

클라이언트 ID·비밀·정확한 callback 경로와 HTTP/HTTPS 형식을 검사한다. 키는 브라우저에 반환하지 않는다.

<a id="file-60"></a>

## src/modules/auth/google.repository.js

역할: 구글 고유 식별자와 MathSite 회원의 ORM 연결

[실제 파일](../src/modules/auth/google.repository.js)

### findAccount

원본 4행.

클라이언트 키 해시와 Google sub로 연결 회원을 조회한다.

### hasConnection

원본 11행.

현재 앱에서 회원에 연결된 구글 계정 존재 여부를 반환한다.

### linkAccount

원본 17행.

기존 연결 충돌을 확인하고 로그인한 회원에게만 구글 식별자를 연결한다.

### createLink

원본 23행.

구글 클라이언트와 계정 식별자를 사이트 회원 ID에 연결한다. 신규 가입 시 계정 생성과 같은 트랜잭션을 사용한다.

<a id="file-61"></a>

## src/modules/auth/google.routes.js

역할: 요청·응답 라우터

[실제 파일](../src/modules/auth/google.routes.js)

### 공통 HTTP 처리 1

원본 5행.

요청 body·응답 헤더·404 또는 오류 응답을 공통으로 처리한다.

### GET /auth/google/status

원본 9행.

요청 값을 status 함수에 전달해 결과를 응답한다.

### GET /auth/google

원본 10행.

요청 값을 start 함수에 전달해 결과를 응답한다.

### GET /auth/google/link

원본 11행.

요청 값을 start 함수에 전달해 결과를 응답한다.

### GET /auth/google/recover

원본 12행.

요청 값을 start 함수에 전달해 결과를 응답한다.

### GET /auth/google/callback

원본 13행.

요청 값을 callback 함수에 전달해 결과를 응답한다.

### POST /auth/google/register

원본 14행.

요청 값을 register 함수에 전달해 결과를 응답한다.

<a id="file-62"></a>

## src/modules/auth/google.service.js

역할: 구글 공통 인증 서비스 구성

[실제 파일](../src/modules/auth/google.service.js)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-63"></a>

## src/modules/auth/kakao.client.js

역할: 카카오 서버와 HTTP 통신

[실제 파일](../src/modules/auth/kakao.client.js)

### authorizationUrl

원본 3행.

config, state를 받는다 → 카카오 인증에 필요한 query string 생성 → 카카오 로그인 URL 문자열 반환.

### kakaoRequest

원본 15행.

url, options를 받는다 → 10초 제한으로 외부 요청, JSON 해석 → 응답 객체 반환. 큰 회원번호는 문자열로 보존하고 실패 시 민감한 원문 대신 일반 오류를 던진다.

### exchangeCode

원본 39행.

config, 인가 code를 받는다 → 토큰 요청 후 토큰으로 /v2/user/me 요청 → 검증된 카카오 고유 회원번호 문자열 반환. 토큰을 프론트나 DB에 저장하지 않는다.

<a id="file-64"></a>

## src/modules/auth/kakao.config.js

역할: 카카오 설정 읽기·검사

[실제 파일](../src/modules/auth/kakao.config.js)

### kakaoConfig

원본 4행.

입력 없음 → 환경 변수와 callback URL 형식을 검사 → 설정 객체와 configured 여부·앱 키 해시 반환.

<a id="file-65"></a>

## src/modules/auth/kakao.repository.js

역할: 카카오 계정과 우리 회원의 ORM 관계 저장

[실제 파일](../src/modules/auth/kakao.repository.js)

### findAccount

원본 4행.

앱 키 해시와 카카오 회원번호로 KakaoAccount를 찾고 연결된 User를 반환한다.

### hasConnection

원본 11행.

앱과 회원의 카카오 연결 존재 여부를 모델 count로 확인한다.

### linkAccount

원본 14행.

기존 연결을 검사하고 새 매핑을 create한다. 타인의 연결이면 409다.

### createLink

원본 20행.

카카오 앱과 회원번호를 사이트 회원 ID에 연결한다. 신규 가입 시 계정 생성과 같은 트랜잭션을 사용한다.

<a id="file-66"></a>

## src/modules/auth/kakao.routes.js

역할: 카카오 인증 URL과 controller 연결

[실제 파일](../src/modules/auth/kakao.routes.js)

### 공통 HTTP 처리 1

원본 5행.

요청 body·응답 헤더·404 또는 오류 응답을 공통으로 처리한다.

### GET /auth/kakao/status

원본 9행.

요청 값을 status 함수에 전달해 결과를 응답한다.

### GET /auth/kakao

원본 10행.

요청 값을 start 함수에 전달해 결과를 응답한다.

### GET /auth/kakao/link

원본 11행.

요청 값을 start 함수에 전달해 결과를 응답한다.

### GET /auth/kakao/recover

원본 12행.

요청 값을 start 함수에 전달해 결과를 응답한다.

### GET /auth/kakao/callback

원본 13행.

요청 값을 callback 함수에 전달해 결과를 응답한다.

### POST /auth/kakao/register

원본 14행.

요청 값을 register 함수에 전달해 결과를 응답한다.

<a id="file-67"></a>

## src/modules/auth/kakao.service.js

역할: 카카오 공통 인증 서비스 구성

[실제 파일](../src/modules/auth/kakao.service.js)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-68"></a>

## src/modules/auth/mail.js

역할: 회원가입 인증코드와 관리자 비밀번호 초기화 메일 발송

[실제 파일](../src/modules/auth/mail.js)

### mailConfigured

원본 7행.

SMTP 호스트·발신 주소·사이트 주소와 메일 계정 인증 정보가 준비되었는지 확인한다.

### canSendResetEmail

원본 14행.

메일 발송용 SMTP 설정 또는 격리 테스트용 파일 전송 수단이 준비됐는지 반환한다.

### requireMail

원본 23행.

메일 발송 수단이 준비되지 않았으면 가입 인증 또는 비밀번호 초기화 용도에 맞는 503 오류를 반환한다.

### sendReset

원본 28행.

관리자 초기화 안내와 30분 토큰 링크를 SMTP TLS로 발송한다. 시험 모드는 비공개 .local에만 저장한다. 실패는 502로 전달하고 전송 연결은 종료한다.

### sendSignupCode

원본 43행.

가입용 6자리 코드와 10분 입력 기한을 담은 이메일을 실제 SMTP 또는 테스트 편지함에 보낸다.

### deliver

원본 54행.

메일 제목·수신 주소·본문을 SMTP로 전송한다. 격리 테스트는 임시 편지함에 기록하며 SMTP 연결은 성공·실패 후 닫는다.

<a id="file-69"></a>

## src/modules/auth/password.js

역할: 반복 PBKDF2 저장과 이전 scrypt 검증

[실제 파일](../src/modules/auth/password.js)

### hashPassword

원본 8행.

새 비밀번호는 8~128자로 제한한다. 로그인 검증 후 과거 짧은 암호를 이전하는 내부 옵션만 예외다. 비밀번호에 임의 salt를 생성하고 PBKDF2-HMAC-SHA256을 600000회 수행한다. 알고리즘·반복 횟수·salt·해시를 담은 문자열을 반환한다.

### needsRehash

원본 21행.

현재 PBKDF2 형식인지 확인한다. 이전 scrypt 저장값은 로그인 검증 후 새 형식으로 갱신할 대상으로 판단한다.

### verifyPassword

원본 25행.

PBKDF2 형식은 저장된 salt로 반복 계산하고 이전 scrypt 형식도 검증한다. 길이·형식을 먼저 제한하고 timingSafeEqual로 비교한다.

<a id="file-70"></a>

## src/modules/auth/register.service.js

역할: 이메일 코드 발송과 검증을 거친 승인 대기 회원 생성

[실제 파일](../src/modules/auth/register.service.js)

### digest

원본 16행.

서버 비밀키로 HMAC을 계산해 브라우저 세션과 이메일 인증코드를 대조할 값을 만든다.

### signupFields

원본 23행.

이메일 가입이 허용되는지 확인하고 주소를 정규화한다. 발송 시 제출한 항목의 중복을 확인하고, 가입 완료 시 현재 켠 항목 전체를 검사한다.

### requestCode

원본 39행.

메일을 보낼 수 있는지 확인하고 같은 주소의 재발송을 60초간 제한한다. 6자리 코드의 검증값과 만료 시각을 저장하고 메일을 보낸 뒤 같은 브라우저에서 확인할 수 있도록 세션을 유지한다.

### register

원본 81행.

같은 브라우저에서 받은 이메일·코드의 유효기간과 실패 횟수를 검사한다. 통과하면 비밀번호 해시와 승인 대기 학생을 저장하고 사용한 코드를 같은 트랜잭션에서 삭제한다.

<a id="file-71"></a>

## src/modules/auth/routes.js

역할: 인증 요청·응답과 인증 서비스 연결

[실제 파일](../src/modules/auth/routes.js)

### 공통 HTTP 처리 1

원본 6행.

요청 body·응답 헤더·404 또는 오류 응답을 공통으로 처리한다.

### GET /api/auth/status

원본 11행.

요청 값을 status 함수에 전달해 결과를 응답한다.

### GET /api/auth/fields

원본 12행.

요청 값을 publicConfiguration 함수에 전달해 결과를 응답한다.

### POST /api/auth/register/code

원본 13행.

요청 값을 requestCode 함수에 전달해 결과를 응답한다.

### POST /api/auth/register

원본 16행.

요청 값을 register 함수에 전달해 결과를 응답한다.

### POST /api/auth/login

원본 19행.

요청 값을 login 함수에 전달해 결과를 응답한다.

### POST /api/auth/logout

원본 20행.

요청 값을 logout 함수에 전달해 결과를 응답한다.

### GET /api/auth/reset/status

원본 25행.

요청 값을 recoveryStatus 함수에 전달해 결과를 응답한다.

### POST /api/auth/reset

원본 29행.

요청 값을 reset 함수에 전달해 결과를 응답한다.

<a id="file-72"></a>

## src/modules/auth/service.js

역할: 로그인·로그아웃·비밀번호 복구와 관리자 초기화

[실제 파일](../src/modules/auth/service.js)

### status

원본 11행.

현재 user로 loggedIn과 user를 반환한다.

### login

원본 15행.

현재 사용하는 아이디 또는 이메일로 계정을 찾는다. 유효하지 않은 자격 증명은 같은 401로 처리하고 성공하면 비밀번호와 승인 상태 확인 뒤 세션을 생성한다.

### enabled

원본 17행.

로그인에 사용할 식별자 항목이 켜져 있는지 정책에서 확인한다.

### logout

원본 48행.

세션 destroy 완료를 기다리고 완료 메시지를 반환한다. 쿠키 제거는 routes.js가 담당한다.

### requireEmailReset

원본 55행.

메일을 이용하는 초기화 요청을 받기 전에 이메일 항목 설정을 확인한다. 꺼져 있으면 404를 응답한다.

### requestAdminReset

원본 60행.

회원 행을 잠근 트랜잭션에서 이전 토큰 제거·새 토큰 저장·기존 비밀번호 무효화·세션 버전 증가·메일 발송을 수행한다. SMTP 실패는 전체 롤백한다.

### recoveryStatus

원본 92행.

서버의 5분 복구 세션과 현재 회원 상태·세션 버전이 일치하는지만 Boolean으로 반환한다.

### reset

원본 103행.

관리자 메일 토큰 또는 소셜 복구 세션을 확인하고 회원 행을 잠가 반복 해시와 세션 버전을 변경한다. 소셜 복구는 5분·동일 버전·활성 회원 조건을 적용하며 완료 후 인증 세션을 폐기한다.

### currentAccount

원본 156행.

세션 ID로 관계를 조회하고 active·세션 버전이 일치하면 공개 회원 객체를 반환한다.

<a id="file-73"></a>

## src/modules/auth/session.js

역할: 로그인 세션 저장·재생성

[실제 파일](../src/modules/auth/session.js)

### saveSession

원본 4행.

Express 세션 저장 콜백을 Promise로 감싸 완료를 기다린다.

### regenerateSession

원본 10행.

세션 ID 재생성을 Promise로 감싸 완료를 기다린다.

### loginSession

원본 17행.

활성 계정·역할을 읽고 일반 로그인은 비밀번호 확인 당시 버전과 같은지도 검사한다. 세션을 재생성해 회원 ID·버전을 저장하고 현재 ON 항목의 회원 정보를 반환한다.

<a id="file-74"></a>

## src/modules/auth/social.service.js

역할: 구글·카카오 공통 로그인·연결·비밀번호 복구 흐름

[실제 파일](../src/modules/auth/social.service.js)

### usesEmailSignup

원본 9행.

회원 항목에서 이메일이 켜져 있는지 확인해 신규 가입 방식을 정한다.

### createSocialService

원본 14행.

공급자 설정·클라이언트·저장소를 받아 동일한 인증 정책의 함수 묶음을 반환한다.

### validPending

원본 17행.

추가 가입 인증의 세션·유효기간·앱 키를 검사한다.

### configRequired

원본 23행.

공급자 설정이 미완성이면 503으로 알린다.

### status

원본 29행.

공급자 설정과 현재 계정 연결 여부를 반환한다. 이메일이 꺼져 있고 유효한 추가 가입 세션이 있어야 registrationRequired가 참이다.

### start

원본 45행.

로그인·연결·복구 모드를 정하고 세션에 10분 state 및 PKCE verifier를 저장한 뒤 인증 주소를 반환한다.

### callback

원본 69행.

OAuth 응답으로 받은 계정 식별자를 확인한다. 기존 계정은 로그인·연결·복구 모드대로 처리한다. 새 계정은 이메일 ON이면 /register로 보내고, OFF이면 10분간 유효한 추가 가입 세션을 만든다.

### register

원본 125행.

이메일이 꺼져 있는지와 같은 브라우저의 인증 세션을 확인한다. 활성 회원 항목을 검사해 학생을 pending으로 만들고 구글·카카오 계정 연결을 같은 트랜잭션에 저장한다.

<a id="file-75"></a>

## src/modules/boards/routes.js

역할: 공지 목록·상세·관리자 작성 API

[실제 파일](../src/modules/boards/routes.js)

### GET /api/boards

원본 6행.

요청 값을 list 함수에 전달해 결과를 응답한다.

### GET /api/boards/popup

원본 7행.

요청 값을 popup 함수에 전달해 결과를 응답한다.

### POST /api/boards

원본 8행.

요청 값을 create 함수에 전달해 결과를 응답한다.

### GET /api/boards/:boardId

원본 11행.

요청 값을 detail 함수에 전달해 결과를 응답한다.

### PATCH /api/boards/:boardId

원본 12행.

요청 값을 edit 함수에 전달해 결과를 응답한다.

### DELETE /api/boards/:boardId

원본 15행.

요청 값을 remove 함수에 전달해 결과를 응답한다.

### PATCH /api/boards/:boardId/pin

원본 18행.

요청 값을 pin 함수에 전달해 결과를 응답한다.

<a id="file-76"></a>

## src/modules/boards/service.js

역할: 공지·팝업·고정 기능

[실제 파일](../src/modules/boards/service.js)

### getBoard

원본 5행.

공지 ID를 모델로 조회하고 없으면 404를 던진다.

### list

원본 10행.

제목 검색·고정 우선·최신 순으로 공지 목록을 조회한다.

### popup

원본 22행.

팝업 설정이 있는 최신 공지 1개 또는 null을 반환한다.

### detail

원본 27행.

선택 공지 정보를 반환한다.

### create

원본 30행.

제목·본문·고정·팝업을 검증해 공지를 생성한다.

### edit

원본 40행.

입력된 제목·본문·고정·팝업만 검증해 수정한다.

### remove

원본 50행.

존재를 확인해 공지를 삭제한다.

### pin

원본 55행.

고정 여부를 검증해 공지 수정 기능을 호출한다.

<a id="file-77"></a>

## src/modules/courses/access.js

역할: 강좌·강의 소속과 현재 시청 권한

[실제 파일](../src/modules/courses/access.js)

### accessWhere

원본 5행.

현재 시각을 기준으로 유효한 학생별 권한의 Sequelize Op 조건 객체를 반환한다.

### getCourse

원본 10행.

강좌를 조회한다. 학생은 공개 강좌에 현재 볼 수 있는 공개 강의가 있는지도 관계 조회로 확인한다.

### getLecture

원본 28행.

강좌 접근·강의 소속·공개 상태·학생 권한을 모델로 검사해 강의 인스턴스를 반환한다.

### publicLecture

원본 43행.

원본 파일명·MIME·HLS 키를 제거하고 videoStatus가 포함된 공개 강의 정보를 반환한다.

<a id="file-78"></a>

## src/modules/courses/lectures.routes.js

역할: 강좌에 속한 영상 업로드·시청 API

[실제 파일](../src/modules/courses/lectures.routes.js)

### GET /api/courses/:courseId/lectures

원본 6행.

요청 값을 list 함수에 전달해 결과를 응답한다.

### POST /api/courses/:courseId/lectures

원본 9행.

요청 값을 create 함수에 전달해 결과를 응답한다.

### PATCH /api/courses/:courseId/lectures/:lectureId

원본 12행.

요청 값을 edit 함수에 전달해 결과를 응답한다.

### DELETE /api/courses/:courseId/lectures/:lectureId

원본 17행.

요청 값을 remove 함수에 전달해 결과를 응답한다.

### POST /api/courses/:courseId/lectures/:lectureId/playback

원본 20행.

요청 값을 playback 함수에 전달해 결과를 응답한다.

### POST /api/courses/:courseId/lectures/:lectureId/convert

원본 23행.

요청 값을 convert 함수에 전달해 결과를 응답한다.

### GET /api/courses/:courseId/lectures/:lectureId/hls/:key/:asset

원본 28행.

요청 값을 hlsFile 함수에 전달해 결과를 응답한다.

### GET /api/courses/:courseId/lectures/:lectureId

원본 41행.

요청 값을 original·openStream 함수에 전달해 결과를 응답한다.

<a id="file-79"></a>

## src/modules/courses/lectures.service.js

역할: 강의 CRUD·재생·스트림 정보 기능

[실제 파일](../src/modules/courses/lectures.service.js)

### list

원본 9행.

해당 강좌의 제목 검색과 공개·권한 관계 조건으로 강의 목록을 반환한다.

### create

원본 32행.

강좌 접근·제목·파일을 검증해 강의를 저장하고 파일이 있으면 변환 큐에 넣는다. 저장 전 실패 파일은 정리한다.

### edit

원본 59행.

메타데이터와 선택 파일을 검증한다. 파일 교체 시 이전 변환 취소·원본/HLS 정리·새 변환을 수행한다.

### remove

원본 98행.

강좌 소속을 확인하고 변환 취소 후 강의·원본·HLS를 삭제한다.

### playback

원본 107행.

현재 권한을 확인해 HLS 준비 상태이면 HLS 주소, 그 외에는 보호된 원본 주소를 반환한다.

### convert

원본 120행.

관리자의 기존 영상 변환·실패 재시도를 등록한다.

### hlsFile

원본 128행.

현재 시청 권한·폴더 키·파일명을 검증해 파일 경로·MIME·내부 전송 주소를 반환한다.

### original

원본 139행.

현재 권한·파일 존재·Range를 검사해 상태·헤더·파일 범위 또는 메타데이터를 반환한다. HTTP 응답은 routes.js가 수행한다.

### openStream

원본 185행.

계산된 파일 경로와 구간으로 ReadStream을 만든다. 연결과 pipe 처리는 라우터가 담당한다.

<a id="file-80"></a>

## src/modules/courses/routes.js

역할: 강좌 묶음 조회·검색·관리 API

[실제 파일](../src/modules/courses/routes.js)

### GET /api/courses

원본 7행.

요청 값을 list 함수에 전달해 결과를 응답한다.

### POST /api/courses

원본 8행.

요청 값을 create 함수에 전달해 결과를 응답한다.

### GET /api/courses/:courseId

원본 11행.

요청 값을 detail 함수에 전달해 결과를 응답한다.

### PATCH /api/courses/:courseId

원본 14행.

요청 값을 edit 함수에 전달해 결과를 응답한다.

### DELETE /api/courses/:courseId

원본 17행.

요청 값을 remove 함수에 전달해 결과를 응답한다.

### PATCH /api/courses/:courseId/status

원본 20행.

요청 값을 changeStatus 함수에 전달해 결과를 응답한다.

<a id="file-81"></a>

## src/modules/courses/service.js

역할: 강좌 CRUD·검색 기능

[실제 파일](../src/modules/courses/service.js)

### list

원본 7행.

관리자는 전체, 학생은 유효한 강의 권한의 강좌 ID와 공개 조건으로 제목 검색을 수행한다.

### detail

원본 25행.

접근이 확인된 강좌를 반환한다.

### create

원본 28행.

입력값을 검증해 Course.create로 강좌를 만든다.

### edit

원본 40행.

기존 강좌와 변경할 입력을 검증해 모델 update로 수정한다.

### remove

원본 52행.

소속 변환 작업을 취소한 뒤 강좌 행·연쇄 관계와 원본·HLS를 정리한다.

### changeStatus

원본 65행.

공개 여부를 검증해 강좌 수정 기능을 호출한다.

<a id="file-82"></a>

## src/modules/courses/upload.js

역할: Multer 업로드·영상 서명 검증

[실제 파일](../src/modules/courses/upload.js)

### filename

원본 11행.

원래 확장자와 무작위 UUID로 저장할 파일명을 만든다.

### fileFilter

원본 15행.

업로드 확장자가 MP4/WebM인지 확인한다. 내용 서명은 checkVideo에서 추가 검사한다.

### checkVideo

원본 25행.

업로드 파일의 앞부분을 읽어 MP4/WebM 서명을 확인하고 MIME을 반환한다.

<a id="file-83"></a>

## src/modules/courses/video.js

역할: FFmpeg 변환 큐·모델 상태 갱신·취소·복구

[실제 파일](../src/modules/courses/video.js)

### hlsPath

원본 12행.

UUID와 허용된 재생 목록·조각 파일명만 받아 HLS 내부 경로를 만든다.

### removeHls

원본 21행.

HLS 루트의 직계 하위 폴더만 검증해 정리한다.

### runFfmpeg

원본 28행.

shell 없이 FFmpeg를 실행해 H.264/AAC HLS를 생성하고 완료 Promise를 반환한다.

### convert

원본 87행.

고유 폴더에 변환하고 같은 원본의 강의가 아직 있으면 모델 상태·HLS 키를 갱신한다. 실패·취소·교체 결과는 정리한다.

### queueConversion

원본 114행.

해당 이전 작업을 취소한 뒤 PROCESSING으로 모델을 수정하고 순차 큐에 등록한다.

### cancelConversion

원본 131행.

대기 작업은 취소 표시, 실행 중 FFmpeg는 종료와 정리를 기다려 파일 잠금을 해제한다.

### resumeConversions

원본 142행.

서버 시작 시 PROCESSING 모델을 조회해 큐에 다시 등록한다.

### waitForConversions

원본 154행.

현재 큐가 완료될 때까지 기다리는 Promise를 반환한다.

<a id="file-84"></a>

## src/modules/info/routes.js

역할: 질문·답변 API

[실제 파일](../src/modules/info/routes.js)

### GET /api/info/qna

원본 6행.

요청 값을 list 함수에 전달해 결과를 응답한다.

### POST /api/info/qna

원본 7행.

요청 값을 create 함수에 전달해 결과를 응답한다.

### GET /api/info/qna/:questionId

원본 10행.

요청 값을 detail 함수에 전달해 결과를 응답한다.

### PATCH /api/info/qna/:questionId

원본 13행.

요청 값을 edit 함수에 전달해 결과를 응답한다.

### DELETE /api/info/qna/:questionId

원본 16행.

요청 값을 remove 함수에 전달해 결과를 응답한다.

### POST /api/info/qna/:questionId/answer

원본 19행.

요청 값을 answer 함수에 전달해 결과를 응답한다.

### PATCH /api/info/qna/:questionId/answer

원본 22행.

요청 값을 answer 함수에 전달해 결과를 응답한다.

### DELETE /api/info/qna/:questionId/answer

원본 25행.

요청 값을 answer 함수에 전달해 결과를 응답한다.

<a id="file-85"></a>

## src/modules/info/service.js

역할: 질문·비공개·작성자·관리자 답변 기능

[실제 파일](../src/modules/info/service.js)

### getQuestion

원본 5행.

질문 존재와 비공개 접근을 검사한다.

### list

원본 12행.

관리자는 전체, 학생은 공개 또는 자기 질문을 모델 조건으로 조회한다.

### create

원본 16행.

현재 사용자를 작성자로 저장하고 입력·비공개 여부를 검증해 질문을 만든다.

### detail

원본 26행.

접근이 확인된 질문 정보를 반환한다.

### edit

원본 29행.

작성자만 본문·제목·비공개 여부를 수정하게 한다.

### remove

원본 39행.

작성자 또는 관리자만 질문을 삭제하게 한다.

### answer

원본 46행.

등록/수정/삭제 동작에 따라 기존 답변 존재 여부를 검사하고 답변·답변자 필드를 수정한다.

<a id="file-86"></a>

## src/modules/manager/member-fields.service.js

역할: 가입·프로필·관리자 수정·응답의 공통 회원 항목 정책

[실제 파일](../src/modules/manager/member-fields.service.js)

### listFields

원본 11행.

매핑 테이블의 항목 사용 여부를 읽는다. 아직 저장하지 않은 항목은 기본 ON이다.

### canRequestResetEmail

원본 20행.

이메일 항목과 발송 수단을 함께 확인해 초기화 메일 요청 가능 여부를 반환한다.

### publicConfiguration

원본 24행.

켜 둔 항목과 메일 초기화 가능 여부만 공개 응답으로 반환한다.

### editFields

원본 29행.

세 항목과 로그인 식별자 조건을 검증하고 MemberField.bulkCreate로 세 설정을 함께 저장한다. 성공하면 적용한 설정을 반환한다.

### validateFields

원본 63행.

켜 둔 항목만 검증하여 반환한다. 꺼 둔 항목을 API로 전송하면 거절한다. partial은 변경할 항목만 검사한다.

### selectFields

원본 85행.

켜 둔 회원정보 키만 응답에 포함한다. 사용하지 않는 정보는 응답에서 제외한다.

<a id="file-87"></a>

## src/modules/manager/routes.js

역할: 관리자 전용 회원·역할·시청 권한 관리 API

[실제 파일](../src/modules/manager/routes.js)

### GET /api/manager/member-fields

원본 7행.

요청 값을 listFields 함수에 전달해 결과를 응답한다.

### PATCH /api/manager/member-fields

원본 8행.

요청 값을 editFields 함수에 전달해 결과를 응답한다.

### GET /api/manager/users

원본 9행.

요청 값을 listUsers 함수에 전달해 결과를 응답한다.

### GET /api/manager/users/:userId

원본 10행.

요청 값을 getUser 함수에 전달해 결과를 응답한다.

### PATCH /api/manager/users/:userId

원본 13행.

요청 값을 editUser 함수에 전달해 결과를 응답한다.

### GET /api/manager/users/:userId/role

원본 16행.

요청 값을 userRole 함수에 전달해 결과를 응답한다.

### PATCH /api/manager/users/:userId/role

원본 19행.

요청 값을 changeRole 함수에 전달해 결과를 응답한다.

### PATCH /api/manager/users/:userId/status

원본 22행.

요청 값을 changeStatus 함수에 전달해 결과를 응답한다.

### DELETE /api/manager/users/:userId

원본 25행.

요청 값을 removeUser 함수에 전달해 결과를 응답한다.

### POST /api/manager/users/:userId/password-reset

원본 28행.

요청 값을 requestAdminReset 함수에 전달해 결과를 응답한다.

### GET /api/manager

원본 32행.

요청 값을 listRoles 함수에 전달해 결과를 응답한다.

### POST /api/manager

원본 33행.

요청 값을 createRole 함수에 전달해 결과를 응답한다.

### PATCH /api/manager

원본 34행.

요청 값을 editRole 함수에 전달해 결과를 응답한다.

### DELETE /api/manager

원본 35행.

요청 값을 removeRole 함수에 전달해 결과를 응답한다.

### GET /api/manager/users/:userId/lectures

원본 37행.

요청 값을 listAccess 함수에 전달해 결과를 응답한다.

### POST /api/manager/users/:userId/lectures

원본 40행.

요청 값을 grantAccess 함수에 전달해 결과를 응답한다.

### DELETE /api/manager/users/:userId/lectures/:lectureId

원본 43행.

요청 값을 revokeAccess 함수에 전달해 결과를 응답한다.

<a id="file-88"></a>

## src/modules/manager/service.js

역할: 관리자 회원·역할·시청 권한 기능

[실제 파일](../src/modules/manager/service.js)

### getUser

원본 9행.

관계를 포함한 회원을 조회하고 없으면 404, 있으면 공개 회원을 반환한다.

### listUsers

원본 15행.

역할 관계를 포함한 회원 목록을 ID 순으로 조회해 공개 형태로 변환한다.

### editUser

원본 28행.

회원 존재 여부를 확인한 뒤 본인 수정과 같은 항목 정책으로 관리자 회원정보 수정을 처리한다. 역할·비밀번호 등 허용하지 않은 입력은 차단한다.

### userRole

원본 32행.

선택 회원의 역할 ID·코드·이름을 반환한다.

### changeUser

원본 37행.

회원 행을 잠그고 마지막 활성 관리자 보호를 검사한 뒤 삭제·상태·역할을 변경한다. 변경 시 세션 버전을 증가시킨다.

### changeRole

원본 78행.

역할의 존재를 검사해 회원 변경 함수를 호출하고 갱신 회원을 반환한다.

### changeStatus

원본 84행.

pending/active/suspended만 허용하고 회원 상태를 변경한다.

### removeUser

원본 90행.

마지막 관리자 보호가 적용된 회원 삭제를 호출한다.

### listRoles

원본 94행.

역할 목록을 ID 순으로 반환한다.

### createRole

원본 97행.

역할 코드·이름을 검증해 일반 역할을 만든다.

### editRole

원본 104행.

역할 이름을 검증해 수정한다.

### removeRole

원본 110행.

기본 역할 삭제를 막고 모델을 삭제한다. 사용 중인 역할은 FK 제약도 보호한다.

### listAccess

원본 118행.

학생의 강의 권한과 강의 관계를 조회해 제목·기간·현재 유효 여부를 반환한다.

### grantAccess

원본 137행.

회원·강의·기간을 확인하고 복합 기본키로 권한을 upsert한다.

### revokeAccess

원본 166행.

학생·강의 복합 조건으로 권한을 삭제한다.

<a id="file-89"></a>

## src/modules/user/routes.js

역할: 로그인한 본인의 회원 정보 API

[실제 파일](../src/modules/user/routes.js)

### GET /api/user

원본 6행.

로그인한 본인의 공개 회원 정보를 응답한다.

### PATCH /api/user

원본 7행.

요청 값을 edit 함수에 전달해 결과를 응답한다.

<a id="file-90"></a>

## src/modules/user/service.js

역할: 본인 프로필 변경

[실제 파일](../src/modules/user/service.js)

### edit

원본 5행.

닉네임·이메일·아이디만 허용·검증해 자기 ORM 행을 수정하고 공개 회원을 반환한다. DB 고유 제약으로 중복을 거절한다.

<a id="file-91"></a>

## src/server.js

역할: DB 확인 후 HTTP 서버 실행

[실제 파일](../src/server.js)

### serve

원본 12행.

화면을 준비하고 로컬 HTTP 요청을 받는다.

### start

원본 18행.

MySQL과 스키마를 준비하고 연결 한도에 걸리면 20초 후 다시 시도한다.

<a id="file-92"></a>

## src/shared/helpers.js

역할: 입력 검증·HTTP 접근 미들웨어·원본 파일 공통 처리

[실제 파일](../src/shared/helpers.js)

### fail

원본 4행.

HTTP 상태와 메시지를 가진 Error를 던진다.

### text

원본 11행.

공백을 제거한 문자열의 타입·필수 여부·최대 길이를 검사한다.

### id

원본 17행.

1 이상의 안전한 정수 ID로 변환한다.

### bool

원본 23행.

true/false와 1/0·문자열을 Boolean으로 변환한다.

### email

원본 29행.

이메일을 소문자로 정리하고 기본 형식을 검사한다.

### username

원본 35행.

영문 소문자 시작, 영문·숫자·밑줄 4~40자의 아이디를 검사한다.

### requireLogin

원본 42행.

req.user가 없으면 401, 있으면 next로 다음 처리에 넘긴다.

### requireAdmin

원본 47행.

로그인·canManage를 검사해 401/403 또는 next로 처리한다.

### videoPath

원본 55행.

단순 파일명만 받아 업로드 폴더 안의 절대 경로를 만든다.

### removeVideo

원본 60행.

검증한 원본 파일을 지운다. 파일이 이미 없으면 무시한다.

<a id="file-93"></a>

## tests/api.test.js

역할: Mocha로 API와 권한의 실제 동작 검사

[실제 파일](../tests/api.test.js)

### client

원본 21행.

입력 없음 → 현재 임시 서버 주소를 사용하는 httpClient 생성 → 요청 함수 반환.

### login

원본 25행.

request 함수, 이메일, 비밀번호 → POST /api/auth/login 후 assert.equal(status,200) → 로그인 user 반환.

### before

원본 32행.

전용 로컬 시험 DB의 합성 자료·임시 서버를 준비한다.

### after

원본 57행.

변환·서버·ORM 연결·시험 파일을 정리한다.

### React 화면의 직접 주소·새로고침과 빌드 자산 제공, API 404 분리

원본 77행.

검사: React 화면의 직접 주소·새로고침과 빌드 자산 제공, API 404 분리. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 서버 상태, 비로그인 차단, 세션 로그인·로그아웃

원본 93행.

검사: 서버 상태, 비로그인 차단, 세션 로그인·로그아웃. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 강좌 목록 필터, 관리자 CRUD, 학생 수정 차단, MySQL 저장

원본 113행.

검사: 강좌 목록 필터, 관리자 CRUD, 학생 수정 차단, MySQL 저장. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 같은 학생 역할도 영상별 허용·미허용·만료·미게시 여부로 구분

원본 146행.

검사: 같은 학생 역할도 영상별 허용·미허용·만료·미게시 여부로 구분. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 실제 영상 업로드·부분 재생·권한 부여와 회수·다른 강좌 ID 차단

원본 187행.

검사: 실제 영상 업로드·부분 재생·권한 부여와 회수·다른 강좌 ID 차단. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 학생 업로드·권한 자체 부여 차단과 위장 파일 검증

원본 229행.

검사: 학생 업로드·권한 자체 부여 차단과 위장 파일 검증. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 공지 관리자 CRUD·고정, 학생 작성·수정·삭제 거절

원본 249행.

검사: 공지 관리자 CRUD·고정, 학생 작성·수정·삭제 거절. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### Q&A 비공개, 작성자 수정, 관리자 답변 등록·수정·삭제

원본 271행.

검사: Q&A 비공개, 작성자 수정, 관리자 답변 등록·수정·삭제. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 회원가입은 승인 대기, 역할 위조 불가, 관리자 승인 후 로그인

원본 311행.

검사: 회원가입은 승인 대기, 역할 위조 불가, 관리자 승인 후 로그인. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 정지·역할 변경은 기존 세션에도 반영, 마지막 관리자 보호

원본 353행.

검사: 정지·역할 변경은 기존 세션에도 반영, 마지막 관리자 보호. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 비밀번호 재설정 토큰 비노출·일회용, 변경 후 기존 세션 무효화

원본 386행.

검사: 비밀번호 재설정 토큰 비노출·일회용, 변경 후 기존 세션 무효화. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 다른 출처 변경 요청과 잘못된 입력을 거절

원본 422행.

검사: 다른 출처 변경 요청과 잘못된 입력을 거절. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

<a id="file-94"></a>

## tests/database-env.js

역할: 테스트가 공유 온라인 DB를 건드리지 못하게 설정

[실제 파일](../tests/database-env.js)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-95"></a>

## tests/features.test.js

역할: ORM·유일성·반복 해시·관리자 초기화·영상 통합 검사

[실제 파일](../tests/features.test.js)

### login

원본 33행.

시험 클라이언트로 합성 계정에 로그인하고 성공한 user를 반환한다.

### freePort

원본 42행.

임시 localhost 포트를 확보하고 반환한다.

### before

원본 51행.

전용 로컬 시험 DB의 합성 자료·임시 서버를 준비한다.

### after

원본 68행.

변환·서버·ORM 연결·시험 파일을 정리한다.

### 마이그레이션 반복 시 기존 회원·강좌 유지

원본 88행.

검사: 마이그레이션 반복 시 기존 회원·강좌 유지. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 구형 발송 시각 열을 수정해 기존 인증코드를 보존하고 첫 가입 메일을 발송한다

원본 102행.

검사: 구형 발송 시각 열을 수정해 기존 인증코드를 보존하고 첫 가입 메일을 발송한다. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 기존 중복 닉네임이 있어도 누락 테이블을 복구하고 회원을 보존

원본 128행.

검사: 기존 중복 닉네임이 있어도 누락 테이블을 복구하고 회원을 보존. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 문자열 아이디 가입·중복 거절·승인 후 아이디/이메일 로그인

원본 169행.

검사: 문자열 아이디 가입·중복 거절·승인 후 아이디/이메일 로그인. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 인증 전에는 계정 미생성, 다른 브라우저·다른 이메일로 사용 불가, 성공한 코드 재사용 거부

원본 214행.

검사: 인증 전에는 계정 미생성, 다른 브라우저·다른 이메일로 사용 불가, 성공한 코드 재사용 거부. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### submit

원본 222행.

브라우저별 세션으로 가입 완료를 요청해 코드가 발급된 브라우저에서만 가입되는지 검사한다.

### count

원본 223행.

테스트 이메일로 저장된 회원 수를 조회해 인증 전과 중복 제출 후의 결과를 확인한다.

### 재전송 대기·기한 만료·오답 제한을 적용하고 새 코드만 승인한다

원본 254행.

검사: 재전송 대기·기한 만료·오답 제한을 적용하고 새 코드만 승인한다. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### verify

원본 262행.

동일한 브라우저·이메일로 입력값을 바꿔 코드 검증 API를 호출한다.

### updateTimes

원본 263행.

로컬 테스트 인증 레코드의 시각을 바꿔 만료 및 재발송을 기다리지 않고 검사한다.

### 인증 메일을 보낼 수 없으면 가입이나 코드 발급이 완료되지 않는다

원본 281행.

검사: 인증 메일을 보낼 수 없으면 가입이나 코드 발급이 완료되지 않는다. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 회원 상세·역할 CRUD·회원 삭제는 관리자만 가능

원본 306행.

검사: 회원 상세·역할 CRUD·회원 삭제는 관리자만 가능. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 팝업 공지 조회·해제, 학생의 팝업 설정 거절

원본 335행.

검사: 팝업 공지 조회·해제, 학생의 팝업 설정 거절. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 공식 채팅 설정과 일반 사용자 재설정 발송은 제거

원본 353행.

검사: 공식 채팅 설정과 일반 사용자 재설정 발송은 제거. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 관리자 초기화만 메일 발송·기존 비밀번호와 세션 무효화

원본 366행.

검사: 관리자 초기화만 메일 발송·기존 비밀번호와 세션 무효화. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### SMTP 발송 함수의 TLS·메일 내용·수신자 구성 (외부 발송 없이)

원본 427행.

검사: SMTP 발송 함수의 TLS·메일 내용·수신자 구성 (외부 발송 없이). 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 아이디·닉네임은 가입과 프로필 수정에서 각각 중복 거절

원본 471행.

검사: 아이디·닉네임은 가입과 프로필 수정에서 각각 중복 거절. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 반복 PBKDF2·개별 salt·이전 scrypt 로그인 시 해시 갱신

원본 516행.

검사: 반복 PBKDF2·개별 salt·이전 scrypt 로그인 시 해시 갱신. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 기존 짧은 비밀번호도 로그인 후 반복 해시로 이전, 신규 짧은 암호는 거절

원본 546행.

검사: 기존 짧은 비밀번호도 로그인 후 반복 해시로 이전, 신규 짧은 암호는 거절. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 실제 SMTP 전달 실패 시 관리자 강제 초기화 전체 롤백

원본 567행.

검사: 실제 SMTP 전달 실패 시 관리자 강제 초기화 전체 롤백. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 라우터는 요청·응답과 서비스 호출만 담당하고 직접 DB 호출하지 않음

원본 619행.

검사: 라우터는 요청·응답과 서비스 호출만 담당하고 직접 DB 호출하지 않음. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### files

원본 621행.

코드 구조 검사에서 대상 폴더의 JavaScript 경로를 재귀 수집한다.

### inspect

원본 634행.

라우터에 직접 모델 동작·분리되지 않은 기능 함수·직접 DB 문장 실행이 있는지 AST로 검사한다.

### 실제 FFmpeg HLS 변환·강의 제목 검색·학생별 권한

원본 674행.

검사: 실제 FFmpeg HLS 변환·강의 제목 검색·학생별 권한. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 실제 Nginx 내부 파일 제공·직접 URL 차단·회수 후 조각 요청 차단

원본 711행.

검사: 실제 Nginx 내부 파일 제공·직접 URL 차단·회수 후 조각 요청 차단. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

<a id="file-96"></a>

## tests/fixtures/sample.mp4

역할: 업로드·부분 재생 검사에 쓰는 짧은 영상

[실제 파일](../tests/fixtures/sample.mp4)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.

<a id="file-97"></a>

## tests/http-client.js

역할: Mocha 테스트용 HTTP 요청 함수 생성

[실제 파일](../tests/http-client.js)

### client

원본 2행.

baseUrl 함수 → 쿠키 보관 변수를 가진 비동기 요청 함수를 반환. 반환 함수는 method·url·body·추가 헤더를 받아 요청하고 {status, headers, json, bytes}를 반환한다. 인증 리다이렉트는 자동으로 따라가지 않는다.

<a id="file-98"></a>

## tests/kakao.test.js

역할: Mocha로 카카오 인증 흐름 검사

[실제 파일](../tests/kakao.test.js)

### client

원본 21행.

입력 없음 → 임시 서버용 httpClient 생성 → 별도 쿠키를 갖는 요청 함수 반환.

### configureEmail

원본 25행.

관리자 HTTP 요청으로 테스트의 이메일 가입 설정을 전환한다.

### passwordLogin

원본 35행.

request 함수, email → 테스트 비밀번호로 이메일 로그인하고 성공 검사 → user 반환.

### start

원본 44행.

request, link(기본 false) → 카카오 시작 요청 후 303·인가 URL·시크릿 비노출 검사 → state 반환.

### authorize

원본 55행.

request, kakaoId, link → start로 state 준비, 합성 인가 code에 회원번호 연결 → callback 요청 결과 반환.

### before

원본 63행.

전용 로컬 시험 DB의 합성 자료·임시 서버를 준비한다.

### after

원본 114행.

변환·서버·ORM 연결·시험 파일을 정리한다.

### 미설정은 로그인 503, 상태 API는 키·시크릿을 노출하지 않음

원본 127행.

검사: 미설정은 로그인 503, 상태 API는 키·시크릿을 노출하지 않음. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### state 세션 결합·일회용·만료와 다른 브라우저 callback 차단

원본 146행.

검사: state 세션 결합·일회용·만료와 다른 브라우저 callback 차단. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 취소·토큰 실패·잘못된 회원번호는 세션 로그인하지 않음

원본 176행.

검사: 취소·토큰 실패·잘못된 회원번호는 세션 로그인하지 않음. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 이메일 OFF: 최초 카카오 인증 → 아이디·닉네임 → 승인 대기, 권한 위조 금지

원본 193행.

검사: 이메일 OFF: 최초 카카오 인증 → 아이디·닉네임 → 승인 대기, 권한 위조 금지. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 관리자는 이메일 인증 후 연결, 카카오 재로그인에도 기존 관리자 유지

원본 268행.

검사: 관리자는 이메일 인증 후 연결, 카카오 재로그인에도 기존 관리자 유지. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 앱 변경 시 계정 자동 연결 금지, 잘못된 callback 주소 거절, 시크릿 비노출

원본 288행.

검사: 앱 변경 시 계정 자동 연결 금지, 잘못된 callback 주소 거절, 시크릿 비노출. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### Long 회원번호를 반올림하지 않고 저장하고 완료 callback 재사용을 차단

원본 311행.

검사: Long 회원번호를 반올림하지 않고 저장하고 완료 callback 재사용을 차단. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

<a id="file-99"></a>

## tests/reset-data.js

역할: 시험 전용 모델 자료 정리

[실제 파일](../tests/reset-data.js)

### resetData

원본 19행.

localhost의 mathsite_test인지 확인한 후 자식부터 모델 destroy를 수행하고 합성 자료를 재생성한다. 운영 DB에는 사용하지 않는다.

<a id="file-100"></a>

## tests/seed.js

역할: 합성 ORM 시험 자료 준비

[실제 파일](../tests/seed.js)

### initialize

원본 17행.

test DB인지 확인하고 매핑·역할을 준비한 뒤 비어 있을 때만 고유 아이디·닉네임의 합성 회원·강좌·영상을 모델로 생성한다.

<a id="file-101"></a>

## tests/signup-mail.js

역할: 격리 테스트에서 가입 인증 메일을 읽는 도우미

[실제 파일](../tests/signup-mail.js)

### openMailbox

원본 7행.

테스트 전용 임시 디렉터리를 만들어 그곳에 가입 인증 메일이 배달되게 한다.

### closeMailbox

원본 11행.

이번 테스트의 임시 편지함을 정리한다.

### requestCode

원본 21행.

실제 발송 API를 호출하고 임시 편지함에서 방금 도착한 주소·코드를 확인한다. 코드가 API 응답에 노출되지 않았는지 검사한다.

### registerByEmail

원본 42행.

테스트 메일에서 읽은 코드·가입 정보·비밀번호로 가입 완료 API를 호출한다.

<a id="file-102"></a>

## tests/social.test.js

역할: 구글·카카오 복구·동적 회원 항목 통합 검사

[실제 파일](../tests/social.test.js)

### login

원본 33행.

시험 계정의 아이디·이메일로 로그인 HTTP 요청을 보낸다.

### begin

원본 36행.

공급자의 로그인·연결·복구를 시작하고 303 인증 주소를 확인한다.

### authorize

원본 41행.

합성 공급자 응답을 준비해 실제 앱의 인증 callback을 처리한다.

### configure

원본 50행.

관리자 세션으로 회원 항목 설정을 저장한다.

### before

원본 60행.

전용 로컬 시험 DB의 합성 자료·임시 서버를 준비한다.

### after

원본 114행.

변환·서버·ORM 연결·시험 파일을 정리한다.

### 구글 미설정·잘못된 복귀 주소 거절과 상태 응답 비밀값 비노출

원본 122행.

검사: 구글 미설정·잘못된 복귀 주소 거절과 상태 응답 비밀값 비노출. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 구글 state·다른 브라우저·취소·코드 재사용 차단과 PKCE

원본 143행.

검사: 구글 state·다른 브라우저·취소·코드 재사용 차단과 PKCE. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 구글 가입은 승인 대기이며 이메일 일치로 관리자 계정과 합치지 않음

원본 171행.

검사: 구글 가입은 승인 대기이며 이메일 일치로 관리자 계정과 합치지 않음. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 이메일 ON이면 신규 구글·카카오 인증과 이전 소셜 가입 세션 모두 이메일 가입을 우회하지 못한다

원본 203행.

검사: 이메일 ON이면 신규 구글·카카오 인증과 이전 소셜 가입 세션 모두 이메일 가입을 우회하지 못한다. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### submit

원본 223행.

이메일을 켜기 전 얻은 소셜 가입 세션을 제출해 정책이 바뀐 뒤 거절되는지 검사한다.

### 신규 이메일 가입 → 관리자 승인 → 구글 연동 뒤 동일한 회원으로 로그인

원본 248행.

검사: 신규 이메일 가입 → 관리자 승인 → 구글 연동 뒤 동일한 회원으로 로그인. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 로그인한 계정에만 소셜 연결, 연결 충돌·권한 상승 차단

원본 278행.

검사: 로그인한 계정에만 소셜 연결, 연결 충돌·권한 상승 차단. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 구글 인증으로 연결된 회원만 비밀번호 변경, 기존 세션·복구 재사용 무효화

원본 297행.

검사: 구글 인증으로 연결된 회원만 비밀번호 변경, 기존 세션·복구 재사용 무효화. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 복구 인증의 5분 만료와 동시 재설정 중 한 번만 성공

원본 354행.

검사: 복구 인증의 5분 만료와 동시 재설정 중 한 번만 성공. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 카카오 재인증·미연결·승인 상태·세션 버전 변경 후 복구 차단

원본 377행.

검사: 카카오 재인증·미연결·승인 상태·세션 버전 변경 후 복구 차단. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 회원 항목 설정은 관리자만, 비정상 설정·모든 로그인 항목 끄기 거절

원본 407행.

검사: 회원 항목 설정은 관리자만, 비정상 설정·모든 로그인 항목 끄기 거절. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 회원 항목 조회 중 DB 연결 한도 초과는 재시도 가능한 503으로 안내한다

원본 429행.

검사: 회원 항목 조회 중 DB 연결 한도 초과는 재시도 가능한 503으로 안내한다. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 설정을 저장·거절·복원해도 모든 기존 회원의 번호와 가입 정보가 보존된다

원본 449행.

검사: 설정을 저장·거절·복원해도 모든 기존 회원의 번호와 가입 정보가 보존된다. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### storedMembers

원본 451행.

합성 회원의 번호·아이디·닉네임·이메일을 읽어 설정 변경 전후의 저장값을 비교한다.

### 회원 표시에는 현재 켜 둔 닉네임·아이디·이메일 값을 순서대로 쓴다

원본 491행.

검사: 회원 표시에는 현재 켜 둔 닉네임·아이디·이메일 값을 순서대로 쓴다. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### fields

원본 499행.

화면 표시 검사에서 현재 켜 둔 회원 항목 목록을 만든다.

### 이메일·닉네임 OFF는 가입·수정·응답·로그인·메일 발송까지 동일 적용

원본 510행.

검사: 이메일·닉네임 OFF는 가입·수정·응답·로그인·메일 발송까지 동일 적용. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 이메일을 끄면 발급된 메일 링크도 404이며 토큰·비밀번호·세션 버전이 유지된다

원본 590행.

검사: 이메일을 끄면 발급된 메일 링크도 404이며 토큰·비밀번호·세션 버전이 유지된다. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 다시 켜면 기존 값 보존, 관리자 수정·본인 수정·중복 제약도 함께 적용

원본 618행.

검사: 다시 켜면 기존 값 보존, 관리자 수정·본인 수정·중복 제약도 함께 적용. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

### 아이디 OFF일 때 이메일 가입·로그인과 NULL 아이디 복수 저장

원본 644행.

검사: 아이디 OFF일 때 이메일 가입·로그인과 NULL 아이디 복수 저장. 실제 요청·모델 상태·허용/거절을 assert로 확인한다.

<a id="file-103"></a>

## vite.config.mjs

역할: React 개발·빌드 설정

[실제 파일](../vite.config.mjs)

사용자가 정의한 이름 있는 함수는 없다. 시작 구문·모델 연결·설정·자료·문서의 역할로 읽는다.
