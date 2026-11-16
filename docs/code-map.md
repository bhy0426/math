# 코드 읽는 순서

처음에는 파일 전체를 외우기보다 요청 한 건을 따라간다. 필요한 함수 설명은 [파일·함수 안내서](functions.md)에서 찾는다.

## 1. 가장 짧은 흐름: 관리자 강좌 추가

1. [app.js](../src/app.js): `/api/courses`를 강좌 라우터에 연결한다.
2. [courses/routes.js](../src/modules/courses/routes.js): POST 요청을 받고 `requireAdmin` 후 `service.create(req.body)`를 호출한다.
3. [courses/service.js](../src/modules/courses/service.js)의 `create`: 제목·설명 등을 검사하고 `Course.create`로 저장한다.
4. [models.js](../src/models.js)의 `Course`: 어떤 속성이 어떤 MySQL 열에 들어갈지 정의한다.
5. [database.js](../src/database.js): 모델이 사용하는 MySQL 연결이다.
6. 다시 routes.js: 반환값을 `res.status(201).json(...)`으로 보낸다.

```text
POST /api/courses + JSON
 → routes: 요청 받기
 → service.create: 검사·저장
 → Course 모델: DB 열에 매핑
 → routes: 201 + JSON 응답
```

라우터의 `(req, res)`에서 req는 요청 정보, res는 응답 도구다. 기능 함수의 `(body)`는 필요한 입력만 받는 일반 함수다. 기능 함수는 HTTP 응답 대신 결과를 반환하고, 문제가 있으면 오류를 던진다.

## 2. 그다음 읽을 서버 코드

| 순서 | 파일                                                           | 확인할 내용                                |
| ---- | -------------------------------------------------------------- | ------------------------------------------ |
| 1    | shared/helpers.js                                              | text·id·bool, requireLogin·requireAdmin    |
| 2    | auth/password.js                                               | 반복 해시 저장·검증                        |
| 3    | auth/routes.js → auth/register.service.js 또는 auth/service.js | 이메일 가입 또는 일반 로그인·비밀번호 변경 |
| 4    | auth/account.js → middleware/session-user.js                   | 현재 회원과 세션 버전 검사                 |
| 5    | manager/member-fields.service.js                               | 항목 ON/OFF 공통 정책                      |
| 6    | user/routes.js → user/service.js                               | 본인 프로필 수정                           |
| 7    | manager/routes.js → manager/service.js                         | 관리자 수정·역할·시청 허용                 |
| 8    | courses/access.js → lectures.service.js                        | 영상별 권한과 재생                         |
| 9    | auth/social.service.js → google.client.js                      | 소셜 인증·연결·복구                        |
| 10   | database/migrate.js → tests/*.test.js                          | 기존 DB 준비와 실제 검사                   |

각 행의 서버 파일은 `src/` 기준이며 이름이 같은 routes.js는 상위 폴더까지 확인한다.

## 3. 화면은 나중에 연결해서 보기

`client/src/main.jsx` → `App.jsx` → `pages/manager/ManagerPage.jsx` → 회원/강좌 컴포넌트 → `shared/api.js` 순서다. 실제 화면 입력은 MemberFields가 만들고, 항목 ON/OFF 값은 AuthProvider가 읽어 공유한다. 목록이나 상단의 회원 표시를 바꾸려면 [memberLabel.mjs](../client/src/shared/memberLabel.mjs)를 본다. 이 함수는 현재 켜 둔 닉네임·아이디·이메일 중 어떤 값을 보여 줄지 정한다.

연습할 때는 서비스의 완료 문구 한 곳을 바꾸고 API 결과를 확인한 다음, 필드 검증과 Mocha 검사를 함께 읽는다. DB 속성을 바꾸는 작업은 모델과 마이그레이션을 함께 확인한다. 공유 DB 자료로 테스트 초기화를 하지 않는다.
