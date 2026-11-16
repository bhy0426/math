# API 목록

라우터 파일에 선언한 요청은 총 68개다. 같은 소셜 라우터가 받는 두 주소는 한 번만 셌다. 회원의 브라우저는 `mathsite.sid` 세션 쿠키로 식별한다.

## 회원가입과 관리자 승인

가입 화면은 `GET /api/auth/fields` 응답에 활성 이메일 항목이 있는지 확인한다. 두 가입 방식 모두 신청이 완료되면 `201`과 `user.status: "pending"`을 반환한다. 관리자가 `PATCH /api/manager/users/:userId/status`에 `{"status":"active"}`를 보내 승인한 뒤 로그인할 수 있다.

| 이메일 설정 | 단계      | 요청과 결과                                                                                                                                                                                                                            |
| ----------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 켬          | 코드 받기 | `POST /api/auth/register/code`에 이메일과 화면에서 입력한 활성 회원 항목을 보낸다. 서버는 중복을 검사한 뒤 6자리 코드를 이메일로 보낸다. 응답은 `200`과 `expiresIn: 600`, `resendAfter: 60`이다. 이 단계에서는 회원을 생성하지 않는다. |
| 켬          | 가입 신청 | 같은 브라우저에서 `POST /api/auth/register`에 활성 회원 항목, 8~128자 비밀번호와 문자열 `code`를 보낸다. 유효한 코드로 가입하면 코드를 한 번 사용하고 폐기한다.                                                                        |
| 끔          | 소셜 인증 | 가입 화면에 설정을 마친 카카오·구글의 버튼이 나타난다. `GET /auth/kakao` 또는 `GET /auth/google`에서 인증을 시작한다. 신규 계정은 콜백 후 `/register?kakao=register` 또는 `/register?google=register`로 돌아온다.                      |
| 끔          | 가입 신청 | 인증한 브라우저에서 `POST /auth/kakao/register` 또는 `POST /auth/google/register`에 현재 켠 회원 항목을 보낸다. 사이트의 승인 대기 학생과 소셜 계정 연결을 함께 저장한다.                                                              |

- 이메일이 켜진 경우 미연결 소셜 계정으로 로그인을 시도하면 이메일 가입 화면 `/register`로 이동한다. 기존 회원은 활성 계정으로 로그인한 뒤 본인 프로필에서 소셜 계정을 연결할 수 있다.
- 사용하지 않는 방식의 가입 API는 `404`다. 이메일·아이디·닉네임 중복은 `409`, 만료되거나 다른 브라우저에서 제출한 코드는 `400`이다. 60초 안에 같은 주소로 재발송하거나 코드를 5회 잘못 입력하면 `429`다. 메일 설정이 빠지면 `503`, SMTP 발송 실패는 `502`다.

## 요청 입력

- 일반 로그인: identifier와 password. 현재 ON인 아이디 또는 이메일로 로그인한다. 등록되지 않은 값이나 꺼진 방식으로 인증을 시도하면 동일한 401을 반환한다. 기존 email 본문 필드도 지원한다.
- 본인/관리자 회원정보 수정: ON인 nickname/username/email 중 바꿀 값. 역할·비밀번호를 이 요청에 넣으면 거절한다.
- 회원 항목 설정: PATCH /api/manager/member-fields, 본문 {fields:[{key:"username",enabled:true},{key:"nickname",enabled:true},{key:"email",enabled:true}]}. 세 항목 모두 Boolean으로 보내며 아이디 또는 이메일은 하나 이상 ON이어야 한다.
- 항목 정책 읽기: GET /api/auth/fields는 공개. GET /api/manager/member-fields는 관리자만 가능하다. 공개 API는 활성 항목과 canRequestResetEmail(이메일 사용 및 메일 발송 준비)을, 관리자 API는 전체 스위치를 반환한다.
- 비밀번호 찾기: /auth/kakao/recover 또는 /auth/google/recover → 공급자 callback → 서버의 5분 복구 세션. GET /api/auth/reset/status는 {verified}만 반환한다. URL의 verified 값은 인증 근거가 아니다.
- 소셜 복구 완료: POST /api/auth/reset에 {password}. 관리자 메일 링크 완료는 같은 API에 {token,password}. 이메일 항목을 끄면 토큰 방식은 404이며 토큰·비밀번호를 변경하지 않는다. 성공하면 기존 로그인은 무효화된다.
- 관리자 초기화: POST /api/manager/users/:userId/password-reset. 본문에 새 비밀번호를 받지 않는다. 기존 암호·세션을 무효화하고 30분 메일 링크를 보낸다. 이메일 항목 OFF이면 404다. 항목을 켠 상태에서 SMTP 미설정은 503, 회원 이메일 없음은 메일 발송 준비 시 409다.
- 강좌: title, description, teacher, isPublished. 공개 상태 변경은 isPublished.
- 강의: title, description, position, isPublished와 선택 video. 파일은 multipart/form-data의 video 필드(MP4/WebM, 250MiB 이하).
- 공지: title, content, isPinned, popupEnabled. 질문: title, content, isPrivate. 답변: answer.
- 회원 상태: status(pending/active/suspended). 역할 변경: roleId. 역할 생성: code/name, 수정: roleId/name, 삭제: roleId. 역할 name은 회원 nickname과 별개다.
- 시청 권한: lectureId와 선택 startsAt/expiresAt. 생략 시 기본 30일.

## 주소·권한

카카오·구글 표의 /auth 경로는 /api/auth 아래에도 같은 Router로 연결된다. GET /health는 별도 상태 검사다. 미로그인은 401, 학생의 관리자 작업은 403이다.

| 메서드 | 주소                                                       | 권한·조건                               | 파일                                                                                   |
| ------ | ---------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| GET    | /auth/google/status                                        | 소셜 인증 흐름                          | [src/modules/auth/google.routes.js:9](../src/modules/auth/google.routes.js)            |
| GET    | /auth/google                                               | 소셜 인증 흐름                          | [src/modules/auth/google.routes.js:10](../src/modules/auth/google.routes.js)           |
| GET    | /auth/google/link                                          | 로그인·본인                             | [src/modules/auth/google.routes.js:11](../src/modules/auth/google.routes.js)           |
| GET    | /auth/google/recover                                       | 소셜 인증 흐름                          | [src/modules/auth/google.routes.js:12](../src/modules/auth/google.routes.js)           |
| GET    | /auth/google/callback                                      | 소셜 인증 흐름                          | [src/modules/auth/google.routes.js:13](../src/modules/auth/google.routes.js)           |
| POST   | /auth/google/register                                      | 이메일 OFF · 같은 브라우저의 소셜 인증  | [src/modules/auth/google.routes.js:14](../src/modules/auth/google.routes.js)           |
| GET    | /auth/kakao/status                                         | 소셜 인증 흐름                          | [src/modules/auth/kakao.routes.js:9](../src/modules/auth/kakao.routes.js)              |
| GET    | /auth/kakao                                                | 소셜 인증 흐름                          | [src/modules/auth/kakao.routes.js:10](../src/modules/auth/kakao.routes.js)             |
| GET    | /auth/kakao/link                                           | 로그인·본인                             | [src/modules/auth/kakao.routes.js:11](../src/modules/auth/kakao.routes.js)             |
| GET    | /auth/kakao/recover                                        | 소셜 인증 흐름                          | [src/modules/auth/kakao.routes.js:12](../src/modules/auth/kakao.routes.js)             |
| GET    | /auth/kakao/callback                                       | 소셜 인증 흐름                          | [src/modules/auth/kakao.routes.js:13](../src/modules/auth/kakao.routes.js)             |
| POST   | /auth/kakao/register                                       | 이메일 OFF · 같은 브라우저의 소셜 인증  | [src/modules/auth/kakao.routes.js:14](../src/modules/auth/kakao.routes.js)             |
| GET    | /api/auth/status                                           | 공개·인증 검증                          | [src/modules/auth/routes.js:11](../src/modules/auth/routes.js)                         |
| GET    | /api/auth/fields                                           | 공개·인증 검증                          | [src/modules/auth/routes.js:12](../src/modules/auth/routes.js)                         |
| POST   | /api/auth/register/code                                    | 이메일 ON · SMTP 준비                   | [src/modules/auth/routes.js:13](../src/modules/auth/routes.js)                         |
| POST   | /api/auth/register                                         | 이메일 ON · 같은 브라우저의 이메일 인증 | [src/modules/auth/routes.js:16](../src/modules/auth/routes.js)                         |
| POST   | /api/auth/login                                            | 공개·인증 검증                          | [src/modules/auth/routes.js:19](../src/modules/auth/routes.js)                         |
| POST   | /api/auth/logout                                           | 공개·인증 검증                          | [src/modules/auth/routes.js:20](../src/modules/auth/routes.js)                         |
| GET    | /api/auth/reset/status                                     | 공개·인증 검증                          | [src/modules/auth/routes.js:25](../src/modules/auth/routes.js)                         |
| POST   | /api/auth/reset                                            | 메일 토큰 또는 소셜 복구 인증           | [src/modules/auth/routes.js:29](../src/modules/auth/routes.js)                         |
| GET    | /api/boards                                                | 로그인                                  | [src/modules/boards/routes.js:6](../src/modules/boards/routes.js)                      |
| GET    | /api/boards/popup                                          | 로그인                                  | [src/modules/boards/routes.js:7](../src/modules/boards/routes.js)                      |
| POST   | /api/boards                                                | 관리자                                  | [src/modules/boards/routes.js:8](../src/modules/boards/routes.js)                      |
| GET    | /api/boards/:boardId                                       | 로그인                                  | [src/modules/boards/routes.js:11](../src/modules/boards/routes.js)                     |
| PATCH  | /api/boards/:boardId                                       | 관리자                                  | [src/modules/boards/routes.js:12](../src/modules/boards/routes.js)                     |
| DELETE | /api/boards/:boardId                                       | 관리자                                  | [src/modules/boards/routes.js:15](../src/modules/boards/routes.js)                     |
| PATCH  | /api/boards/:boardId/pin                                   | 관리자                                  | [src/modules/boards/routes.js:18](../src/modules/boards/routes.js)                     |
| GET    | /api/courses/:courseId/lectures                            | 로그인·시청 권한                        | [src/modules/courses/lectures.routes.js:6](../src/modules/courses/lectures.routes.js)  |
| POST   | /api/courses/:courseId/lectures                            | 관리자                                  | [src/modules/courses/lectures.routes.js:9](../src/modules/courses/lectures.routes.js)  |
| PATCH  | /api/courses/:courseId/lectures/:lectureId                 | 관리자                                  | [src/modules/courses/lectures.routes.js:12](../src/modules/courses/lectures.routes.js) |
| DELETE | /api/courses/:courseId/lectures/:lectureId                 | 관리자                                  | [src/modules/courses/lectures.routes.js:17](../src/modules/courses/lectures.routes.js) |
| POST   | /api/courses/:courseId/lectures/:lectureId/playback        | 로그인·시청 권한                        | [src/modules/courses/lectures.routes.js:20](../src/modules/courses/lectures.routes.js) |
| POST   | /api/courses/:courseId/lectures/:lectureId/convert         | 관리자                                  | [src/modules/courses/lectures.routes.js:23](../src/modules/courses/lectures.routes.js) |
| GET    | /api/courses/:courseId/lectures/:lectureId/hls/:key/:asset | 로그인·시청 권한                        | [src/modules/courses/lectures.routes.js:28](../src/modules/courses/lectures.routes.js) |
| GET    | /api/courses/:courseId/lectures/:lectureId                 | 로그인·시청 권한                        | [src/modules/courses/lectures.routes.js:41](../src/modules/courses/lectures.routes.js) |
| GET    | /api/courses                                               | 로그인·강좌 공개 범위                   | [src/modules/courses/routes.js:7](../src/modules/courses/routes.js)                    |
| POST   | /api/courses                                               | 관리자                                  | [src/modules/courses/routes.js:8](../src/modules/courses/routes.js)                    |
| GET    | /api/courses/:courseId                                     | 로그인·강좌 공개 범위                   | [src/modules/courses/routes.js:11](../src/modules/courses/routes.js)                   |
| PATCH  | /api/courses/:courseId                                     | 관리자                                  | [src/modules/courses/routes.js:14](../src/modules/courses/routes.js)                   |
| DELETE | /api/courses/:courseId                                     | 관리자                                  | [src/modules/courses/routes.js:17](../src/modules/courses/routes.js)                   |
| PATCH  | /api/courses/:courseId/status                              | 관리자                                  | [src/modules/courses/routes.js:20](../src/modules/courses/routes.js)                   |
| GET    | /api/info/qna                                              | 로그인·비공개 접근 검사                 | [src/modules/info/routes.js:6](../src/modules/info/routes.js)                          |
| POST   | /api/info/qna                                              | 로그인·비공개 접근 검사                 | [src/modules/info/routes.js:7](../src/modules/info/routes.js)                          |
| GET    | /api/info/qna/:questionId                                  | 로그인·비공개 접근 검사                 | [src/modules/info/routes.js:10](../src/modules/info/routes.js)                         |
| PATCH  | /api/info/qna/:questionId                                  | 작성자                                  | [src/modules/info/routes.js:13](../src/modules/info/routes.js)                         |
| DELETE | /api/info/qna/:questionId                                  | 작성자·관리자                           | [src/modules/info/routes.js:16](../src/modules/info/routes.js)                         |
| POST   | /api/info/qna/:questionId/answer                           | 관리자                                  | [src/modules/info/routes.js:19](../src/modules/info/routes.js)                         |
| PATCH  | /api/info/qna/:questionId/answer                           | 관리자                                  | [src/modules/info/routes.js:22](../src/modules/info/routes.js)                         |
| DELETE | /api/info/qna/:questionId/answer                           | 관리자                                  | [src/modules/info/routes.js:25](../src/modules/info/routes.js)                         |
| GET    | /api/manager/member-fields                                 | 관리자                                  | [src/modules/manager/routes.js:7](../src/modules/manager/routes.js)                    |
| PATCH  | /api/manager/member-fields                                 | 관리자                                  | [src/modules/manager/routes.js:8](../src/modules/manager/routes.js)                    |
| GET    | /api/manager/users                                         | 관리자                                  | [src/modules/manager/routes.js:9](../src/modules/manager/routes.js)                    |
| GET    | /api/manager/users/:userId                                 | 관리자                                  | [src/modules/manager/routes.js:10](../src/modules/manager/routes.js)                   |
| PATCH  | /api/manager/users/:userId                                 | 관리자                                  | [src/modules/manager/routes.js:13](../src/modules/manager/routes.js)                   |
| GET    | /api/manager/users/:userId/role                            | 관리자                                  | [src/modules/manager/routes.js:16](../src/modules/manager/routes.js)                   |
| PATCH  | /api/manager/users/:userId/role                            | 관리자                                  | [src/modules/manager/routes.js:19](../src/modules/manager/routes.js)                   |
| PATCH  | /api/manager/users/:userId/status                          | 관리자                                  | [src/modules/manager/routes.js:22](../src/modules/manager/routes.js)                   |
| DELETE | /api/manager/users/:userId                                 | 관리자                                  | [src/modules/manager/routes.js:25](../src/modules/manager/routes.js)                   |
| POST   | /api/manager/users/:userId/password-reset                  | 관리자                                  | [src/modules/manager/routes.js:28](../src/modules/manager/routes.js)                   |
| GET    | /api/manager                                               | 관리자                                  | [src/modules/manager/routes.js:32](../src/modules/manager/routes.js)                   |
| POST   | /api/manager                                               | 관리자                                  | [src/modules/manager/routes.js:33](../src/modules/manager/routes.js)                   |
| PATCH  | /api/manager                                               | 관리자                                  | [src/modules/manager/routes.js:34](../src/modules/manager/routes.js)                   |
| DELETE | /api/manager                                               | 관리자                                  | [src/modules/manager/routes.js:35](../src/modules/manager/routes.js)                   |
| GET    | /api/manager/users/:userId/lectures                        | 관리자                                  | [src/modules/manager/routes.js:37](../src/modules/manager/routes.js)                   |
| POST   | /api/manager/users/:userId/lectures                        | 관리자                                  | [src/modules/manager/routes.js:40](../src/modules/manager/routes.js)                   |
| DELETE | /api/manager/users/:userId/lectures/:lectureId             | 관리자                                  | [src/modules/manager/routes.js:43](../src/modules/manager/routes.js)                   |
| GET    | /api/user                                                  | 로그인·본인                             | [src/modules/user/routes.js:6](../src/modules/user/routes.js)                          |
| PATCH  | /api/user                                                  | 로그인·본인                             | [src/modules/user/routes.js:7](../src/modules/user/routes.js)                          |

## 영상 응답

playback은 {lecture,format,playbackUrl}을 반환한다. HLS의 재생 목록과 조각마다 현재 권한을 검사한다. GET 개별 강의는 영상 원본이며 ?info=1은 메타데이터 JSON이다. 정상 Range는 206, 잘못된 범위는 416이다. 변환 시작은 202다.

## 오류

400 입력·인증 오류, 401 로그인 필요·자격 불일치, 403 승인 대기·작업 또는 시청 권한 없음, 404 대상·소속·가입 방식 없음, 409 중복·상태 충돌, 413 파일 초과, 416 범위 오류, 429 인증 시도·재발송 횟수 초과, 502 공급자·메일 전달 실패, 503 외부 설정 미준비 또는 DB 동시 접속 한도 초과. DB 접속 한도 오류에는 Retry-After 헤더를 보낸다. 실패 본문은 {message}다.

공식 채팅·채널 설정 API는 제거했다. 회원 응답에서는 OFF인 프로필 속성과 비밀번호 해시·세션 버전을 제외한다. 상세 동작은 [인수인계서](HANDOFF.md), 실제 공급자 설정은 [소셜 로그인 안내](social-login.md)를 본다.
