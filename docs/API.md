# API 목록

회원의 브라우저는 `mathsite.sid` 세션 쿠키로 식별한다.

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

### 가입 항목 중복 확인

`POST /api/auth/register/check`에 `{"field":"nickname","value":"새별"}`을 보내 아이디·닉네임·이메일 한 항목을 확인한다. 사용 가능하면 200, 중복은 409, 꺼진 항목은 404다. 회원 번호를 만들지 않는다. 가입 확정 시점에 다시 중복을 검사한다.

### 관리자 발신 메일

가입·로그인 설정에서 이메일을 켜면 관리자 메일 기능을 사용할 수 있다. 이메일을 끄면 로그인한 관리자가 `/api/manager/mail` 또는 `/api/manager/broadcasts`와 그 하위 주소를 직접 호출해도 404를 반환한다. 발신 계정과 과거 발송 결과는 보존한다.

| 메서드 | 주소                             | 동작                                                                                                      |
| ------ | -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| GET    | `/api/manager/mail`              | 확인한 발신 주소, 메일함 인증 시각, 최근 SMTP 확인 상태와 시각, 현재 세션의 등록 대기 건을 조회한다.      |
| POST   | `/api/manager/mail/check`        | 등록된 계정으로 SMTP 로그인 연결을 검사한다. 인증 거절과 일시적인 연결 실패를 구분한다. 미등록이면 409다. |
| POST   | `/api/manager/mail/verification` | `email`, `appPassword`로 새 주소에 6자리 코드를 보내고 `verificationId`와 만료 시각을 받는다.             |
| POST   | `/api/manager/mail/confirm`      | 같은 관리자 세션에서 `verificationId`, `code`를 보내 발신자를 교체한다.                                   |

`verifiedAt`은 수신 코드로 메일함을 확인한 시각이다. `connectionStatus`는 `unregistered`, `unchecked`, `connected`, `auth_failed`, `unavailable` 중 하나이며 `checkedAt`은 해당 연결 결과의 시각이다. 등록은 재시작 후에도 유지되고 연결 상태는 새 서버 프로세스에서 다시 검사한다.

### 관리자 회원 그룹과 일괄 발송

아래 주소는 모두 `/api/manager` 아래에 연결된다. [그룹 라우터](../src/modules/manager/groups.routes.js) · [학생 메일 라우터](../src/modules/manager/broadcast.routes.js)

| 메서드 | 하위 주소                  | 입력과 결과                                                                                                                                        |
| ------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/groups`                  | `groups` 배열. 각 그룹은 `id`, `name`, `memberIds`를 갖는다.                                                                                       |
| POST   | `/groups`                  | `name`으로 그룹 생성. 201과 새 그룹을 반환한다.                                                                                                    |
| PATCH  | `/groups/:groupId`         | `name`으로 그룹 이름을 수정한다.                                                                                                                   |
| DELETE | `/groups/:groupId`         | 그룹과 소속 관계를 삭제한다. 회원과 이미 저장한 시청 권한은 유지한다.                                                                              |
| PATCH  | `/groups/:groupId/members` | `addUserIds`, `removeUserIds`로 소속 변경분을 적용한다.                                                                                            |
| POST   | `/groups/:groupId/access`  | `userIds`, `lectureIds`, `action`을 보낸다. `grant`에는 선택적으로 ISO 날짜 `startsAt`, `expiresAt`을 사용하고, `revoke`는 선택한 조합만 회수한다. |
| GET    | `/broadcasts/recipients`   | `?groupId=숫자`로 특정 그룹을 선택할 수 있다. 활성 일반 회원 중 유효한 이메일이 있는 학생 목록을 반환한다.                                         |
| POST   | `/broadcasts`              | `requestId`(UUID v4), `groupId`(선택), `userIds`, `subject`, `body`를 보낸다. 처리 중 202, 완료 결과 200.                                          |
| GET    | `/broadcasts/:requestId`   | 요청한 관리자에게만 전체 상태와 학생별 결과를 반환한다. 다른 관리자의 요청은 404다.                                                                |

그룹에서 제외할 학생은 `userIds`에 넣지 않는다. 소속·승인 상태가 달라진 대상은 변경 시 다시 검사한다. 중복 요청을 막기 위해 동일 `requestId`와 동일 내용은 기존 결과를 조회하고, 같은 번호의 다른 내용은 409로 거절한다. 학생별 `sent`는 SMTP 서버 수락, `failed`는 실패, `unknown`은 실제 전송 여부가 불확실한 결과다.

## 요청 입력

- 일반 로그인: identifier와 password. 현재 ON인 아이디 또는 이메일로 로그인한다. 등록되지 않은 값이나 꺼진 방식으로 인증을 시도하면 동일한 401을 반환한다. 기존 email 본문 필드도 지원한다.
- 본인/관리자 회원정보 수정: ON인 nickname/username/email 중 바꿀 값. 역할·비밀번호를 이 요청에 넣으면 거절한다.
- 회원 항목 설정: PATCH /api/manager/member-fields, 본문 {fields:[{key:"username",enabled:true},{key:"nickname",enabled:true},{key:"email",enabled:true}]}. 세 항목 모두 Boolean으로 보내며 아이디 또는 이메일은 하나 이상 ON이어야 한다.
- 아이디 또는 이메일 로그인 방식을 끌 때는 활성 관리자 중 한 명 이상에게 남은 항목의 값이나 현재 앱에 연결된 소셜 계정이 있어야 한다. 조건을 충족하지 않으면 409이며 기존 설정을 유지한다.
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

| 메서드 | 주소                                                       | 권한·조건                               | 파일                                                                                |
| ------ | ---------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| GET    | /auth/google/status                                        | 소셜 인증 흐름                          | [src/modules/auth/social.routes.js](../src/modules/auth/social.routes.js)           |
| GET    | /auth/google                                               | 소셜 인증 흐름                          | [src/modules/auth/social.routes.js](../src/modules/auth/social.routes.js)           |
| GET    | /auth/google/link                                          | 로그인·본인                             | [src/modules/auth/social.routes.js](../src/modules/auth/social.routes.js)           |
| GET    | /auth/google/recover                                       | 소셜 인증 흐름                          | [src/modules/auth/social.routes.js](../src/modules/auth/social.routes.js)           |
| GET    | /auth/google/callback                                      | 소셜 인증 흐름                          | [src/modules/auth/social.routes.js](../src/modules/auth/social.routes.js)           |
| POST   | /auth/google/register                                      | 이메일 OFF · 같은 브라우저의 소셜 인증  | [src/modules/auth/social.routes.js](../src/modules/auth/social.routes.js)           |
| GET    | /auth/kakao/status                                         | 소셜 인증 흐름                          | [src/modules/auth/social.routes.js](../src/modules/auth/social.routes.js)           |
| GET    | /auth/kakao                                                | 소셜 인증 흐름                          | [src/modules/auth/social.routes.js](../src/modules/auth/social.routes.js)           |
| GET    | /auth/kakao/link                                           | 로그인·본인                             | [src/modules/auth/social.routes.js](../src/modules/auth/social.routes.js)           |
| GET    | /auth/kakao/recover                                        | 소셜 인증 흐름                          | [src/modules/auth/social.routes.js](../src/modules/auth/social.routes.js)           |
| GET    | /auth/kakao/callback                                       | 소셜 인증 흐름                          | [src/modules/auth/social.routes.js](../src/modules/auth/social.routes.js)           |
| POST   | /auth/kakao/register                                       | 이메일 OFF · 같은 브라우저의 소셜 인증  | [src/modules/auth/social.routes.js](../src/modules/auth/social.routes.js)           |
| GET    | /api/auth/status                                           | 공개·인증 검증                          | [src/modules/auth/routes.js](../src/modules/auth/routes.js)                         |
| GET    | /api/auth/fields                                           | 공개·인증 검증                          | [src/modules/auth/routes.js](../src/modules/auth/routes.js)                         |
| POST   | /api/auth/register/code                                    | 이메일 ON · SMTP 준비                   | [src/modules/auth/routes.js](../src/modules/auth/routes.js)                         |
| POST   | /api/auth/register                                         | 이메일 ON · 같은 브라우저의 이메일 인증 | [src/modules/auth/routes.js](../src/modules/auth/routes.js)                         |
| POST   | /api/auth/login                                            | 공개·인증 검증                          | [src/modules/auth/routes.js](../src/modules/auth/routes.js)                         |
| POST   | /api/auth/logout                                           | 공개·인증 검증                          | [src/modules/auth/routes.js](../src/modules/auth/routes.js)                         |
| GET    | /api/auth/reset/status                                     | 공개·인증 검증                          | [src/modules/auth/routes.js](../src/modules/auth/routes.js)                         |
| POST   | /api/auth/reset                                            | 메일 토큰 또는 소셜 복구 인증           | [src/modules/auth/routes.js](../src/modules/auth/routes.js)                         |
| GET    | /api/boards                                                | 로그인                                  | [src/modules/boards/routes.js](../src/modules/boards/routes.js)                     |
| GET    | /api/boards/popup                                          | 로그인                                  | [src/modules/boards/routes.js](../src/modules/boards/routes.js)                     |
| POST   | /api/boards                                                | 관리자                                  | [src/modules/boards/routes.js](../src/modules/boards/routes.js)                     |
| GET    | /api/boards/:boardId                                       | 로그인                                  | [src/modules/boards/routes.js](../src/modules/boards/routes.js)                     |
| PATCH  | /api/boards/:boardId                                       | 관리자                                  | [src/modules/boards/routes.js](../src/modules/boards/routes.js)                     |
| DELETE | /api/boards/:boardId                                       | 관리자                                  | [src/modules/boards/routes.js](../src/modules/boards/routes.js)                     |
| PATCH  | /api/boards/:boardId/pin                                   | 관리자                                  | [src/modules/boards/routes.js](../src/modules/boards/routes.js)                     |
| GET    | /api/courses/:courseId/lectures                            | 로그인·시청 권한                        | [src/modules/courses/lectures.routes.js](../src/modules/courses/lectures.routes.js) |
| POST   | /api/courses/:courseId/lectures                            | 관리자                                  | [src/modules/courses/lectures.routes.js](../src/modules/courses/lectures.routes.js) |
| PATCH  | /api/courses/:courseId/lectures/:lectureId                 | 관리자                                  | [src/modules/courses/lectures.routes.js](../src/modules/courses/lectures.routes.js) |
| DELETE | /api/courses/:courseId/lectures/:lectureId                 | 관리자                                  | [src/modules/courses/lectures.routes.js](../src/modules/courses/lectures.routes.js) |
| POST   | /api/courses/:courseId/lectures/:lectureId/playback        | 로그인·시청 권한                        | [src/modules/courses/lectures.routes.js](../src/modules/courses/lectures.routes.js) |
| POST   | /api/courses/:courseId/lectures/:lectureId/convert         | 관리자                                  | [src/modules/courses/lectures.routes.js](../src/modules/courses/lectures.routes.js) |
| GET    | /api/courses/:courseId/lectures/:lectureId/hls/:key/:asset | 로그인·시청 권한                        | [src/modules/courses/lectures.routes.js](../src/modules/courses/lectures.routes.js) |
| GET    | /api/courses/:courseId/lectures/:lectureId                 | 로그인·시청 권한                        | [src/modules/courses/lectures.routes.js](../src/modules/courses/lectures.routes.js) |
| GET    | /api/courses                                               | 로그인·강좌 공개 범위                   | [src/modules/courses/routes.js](../src/modules/courses/routes.js)                   |
| POST   | /api/courses                                               | 관리자                                  | [src/modules/courses/routes.js](../src/modules/courses/routes.js)                   |
| GET    | /api/courses/:courseId                                     | 로그인·강좌 공개 범위                   | [src/modules/courses/routes.js](../src/modules/courses/routes.js)                   |
| PATCH  | /api/courses/:courseId                                     | 관리자                                  | [src/modules/courses/routes.js](../src/modules/courses/routes.js)                   |
| DELETE | /api/courses/:courseId                                     | 관리자                                  | [src/modules/courses/routes.js](../src/modules/courses/routes.js)                   |
| PATCH  | /api/courses/:courseId/status                              | 관리자                                  | [src/modules/courses/routes.js](../src/modules/courses/routes.js)                   |
| GET    | /api/info/qna                                              | 로그인·비공개 접근 검사                 | [src/modules/info/routes.js](../src/modules/info/routes.js)                         |
| POST   | /api/info/qna                                              | 로그인·비공개 접근 검사                 | [src/modules/info/routes.js](../src/modules/info/routes.js)                         |
| GET    | /api/info/qna/:questionId                                  | 로그인·비공개 접근 검사                 | [src/modules/info/routes.js](../src/modules/info/routes.js)                         |
| PATCH  | /api/info/qna/:questionId                                  | 작성자                                  | [src/modules/info/routes.js](../src/modules/info/routes.js)                         |
| DELETE | /api/info/qna/:questionId                                  | 작성자·관리자                           | [src/modules/info/routes.js](../src/modules/info/routes.js)                         |
| POST   | /api/info/qna/:questionId/answer                           | 관리자                                  | [src/modules/info/routes.js](../src/modules/info/routes.js)                         |
| PATCH  | /api/info/qna/:questionId/answer                           | 관리자                                  | [src/modules/info/routes.js](../src/modules/info/routes.js)                         |
| DELETE | /api/info/qna/:questionId/answer                           | 관리자                                  | [src/modules/info/routes.js](../src/modules/info/routes.js)                         |
| GET    | /api/manager/member-fields                                 | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| PATCH  | /api/manager/member-fields                                 | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| GET    | /api/manager/users                                         | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| GET    | /api/manager/users/:userId                                 | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| PATCH  | /api/manager/users/:userId                                 | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| GET    | /api/manager/users/:userId/role                            | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| PATCH  | /api/manager/users/:userId/role                            | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| PATCH  | /api/manager/users/:userId/status                          | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| DELETE | /api/manager/users/:userId                                 | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| POST   | /api/manager/users/:userId/password-reset                  | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| GET    | /api/manager                                               | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| POST   | /api/manager                                               | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| PATCH  | /api/manager                                               | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| DELETE | /api/manager                                               | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| GET    | /api/manager/users/:userId/lectures                        | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| POST   | /api/manager/users/:userId/lectures                        | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| DELETE | /api/manager/users/:userId/lectures/:lectureId             | 관리자                                  | [src/modules/manager/routes.js](../src/modules/manager/routes.js)                   |
| GET    | /api/user                                                  | 로그인·본인                             | [src/modules/user/routes.js](../src/modules/user/routes.js)                         |
| PATCH  | /api/user                                                  | 로그인·본인                             | [src/modules/user/routes.js](../src/modules/user/routes.js)                         |

## 영상 응답

playback은 {lecture,format,playbackUrl}을 반환한다. 서버 저장소에 HLS 재생 목록이 있으면 HLS, 원본만 있으면 원본을 선택한다. 양쪽 파일이 모두 없으면 404를 반환한다. HLS 재생 목록과 조각마다 현재 권한을 검사한다. GET 개별 강의는 영상 원본이며 ?info=1은 메타데이터 JSON이다. 정상 Range는 206, 잘못된 범위는 416이다. 수동 재변환은 로컬 원본이 있어야 시작하며, 접수 시 202를 반환한다.

## 오류

400 입력·인증 오류, 401 로그인 필요·자격 불일치, 403 승인 대기·작업 또는 시청 권한 없음, 404 대상·소속·가입 방식 없음, 409 중복·상태 충돌, 413 파일 초과, 416 범위 오류, 429 인증 시도·재발송 횟수 초과, 502 공급자·메일 전달 실패, 503 외부 설정 미준비 또는 DB 동시 접속 한도 초과. DB 접속 한도 오류에는 Retry-After 헤더를 보낸다. 실패 본문은 {message}다.

공식 채팅·채널 설정 API는 제거했다. 회원 응답에서는 OFF인 프로필 속성과 비밀번호 해시·세션 버전을 제외한다. 상세 동작은 [인수인계서](HANDOFF.md), 실제 공급자 설정은 [소셜 로그인 안내](social-login.md)를 본다.
