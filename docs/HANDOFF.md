# MathSite 인수인계서

2026-11-16 기준. 팀은 `bhy0426/math` 저장소의 `main` 브랜치를 기준으로 코드를 공유한다. 배포용 ZIP에는 같은 커밋의 소스와 문서가 들어간다.

## 1. 먼저 알아둘 규칙

이 사이트는 학원이 회원을 승인하고 개별 강의를 허용하는 구조다. 구매·결제는 없다.

| 구분                     | 의미                                   |
| ------------------------ | -------------------------------------- |
| 강좌 courses             | 중등 수학 기초반 같은 수업 묶음        |
| 강의 lectures            | 강좌 안의 한 수업과 영상               |
| 역할 roles               | 관리자 작업을 할 수 있는 계정인지 구분 |
| 시청 권한 lecture_access | 학생·강의·시청 시작일·만료일           |
| 회원 항목 member_fields  | 아이디·닉네임·이메일의 수집·사용 여부  |

승인과 시청 허용은 다르다. active 학생이라도 강의 권한이 없으면 시청할 수 없다. 서버가 매 요청마다 역할·승인 상태·유효기간·강좌 소속·공개 상태를 검사한다. 관리자 버튼을 숨기는 것만으로 권한을 처리하지 않는다.

## 2. 읽는 순서

1. 이 문서로 실행 조건과 현재 상태를 확인한다.
2. [구조 지도](architecture.md)로 폴더 관계를 본다.
3. [코드 읽는 순서](code-map.md)에서 요청 한 건을 따라간다.
4. [파일·함수 안내서](functions.md)에서 수정하려는 함수를 찾는다.
5. [API 목록](API.md)에서 요청·응답·권한을 확인한다.

두 `src`는 실행 장소가 다르다. `client/src`는 브라우저의 React, 루트 `src`는 Node.js 서버다. 화면 `/courses`와 데이터 요청 `/api/courses`도 다르다.

## 3. 파일 역할과 수정 원칙

```text
src/app.js                         전체 API 주소 연결·세션·오류 응답
src/models.js                      Sequelize 테이블·열·관계 매핑
src/database.js                    MySQL 연결과 연결 풀
src/modules/기능명/routes.js       요청 값 전달·HTTP 응답
src/modules/기능명/service.js      입력 검사·권한·처리·모델 호출
database/migrate.js                기존 DB를 모델 구조에 맞게 준비
client/src/pages                   화면
client/src/shared                  공통 로그인 상태·입력·요청
tests                              Mocha와 합성 자료
```

예를 들어 회원정보를 수정할 때 `manager/routes.js`는 `service.editUser`를 호출하고 응답한다. 실제 처리 함수는 **같은 manager 폴더**의 `service.js`에 있다. 본인 수정과 공유할 처리는 user/service로 위임하고, 공통 항목 정책은 manager/member-fields.service에 둔다.

강의도 courses 폴더 안의 `lectures.routes.js`와 `lectures.service.js`로 구분한다. 업로드는 `upload.js`, 변환 작업은 `video.js`, 시청 검사는 `access.js`다. 라우터 파일에 DB·파일·암호 계산 코드를 다시 넣지 않는다.

## 4. 실행과 새 PC 설정

Node.js 22.12 이상. 확인한 버전은 26.13.0이다.

```powershell
# 프로젝트 폴더에서 실행한다.
npm.cmd ci
# .env.example을 .env로 복사하고 실제 비공개 값을 입력한다.
npm.cmd run db:init
npm.cmd run dev
```

기본 주소: `http://127.0.0.1:3000/`. 일반 실행은 `npm.cmd start`, 종료는 터미널의 `Ctrl+C`다. 서버 재시작 시 메모리 세션이 사라져 다시 로그인한다.

새 PC는 MySQL의 **데이터베이스 자체와 계정**을 먼저 준비하고 `.env`에 입력한다. `db:init`은 그 DB 안의 테이블·열·역할을 준비하는 명령이다. 기존 회원이 있으면 최초 관리자 환경 변수로 계정을 덮어쓰지 않는다. 새 DB가 비어 있을 때만 `ADMIN_NICKNAME`, `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`로 관리자를 생성한다. 새 비밀번호는 8~128자다.

## 5. 공유 DB 적용 상태

개발 DB는 Filess.io 온라인 MySQL이다. 회원 항목·구글 연결 등 누락 테이블을 준비했다. 기존 중복 닉네임은 사용자 요청대로 보존하고 닉네임 고유 인덱스만 보류한다. 새로 입력하는 닉네임은 앱에서 중복 검사한다. DB 고유 제약은 기존 중복 정리 후 db:init을 실행하면 추가된다. 인덱스 보류 기간에는 동시 가입 시 DB에서 닉네임의 유일성을 보장할 수 없다.

로컬 mathsite_test에는 매핑·제약을 적용해 검사했다. 기존 중복 닉네임과 누락된 member_fields 테이블을 함께 재현한 회귀 검사도 포함한다. 서버는 시작할 때 initialize를 호출해 필요한 구조를 준비한다.

구형 공유 DB에서는 `signup_codes.sent_at` 열에 `NOT NULL` 제약이 있어 첫 가입 코드를 저장할 때 오류가 났다. 발송 요청은 먼저 코드 행을 확보한 뒤 같은 트랜잭션에서 발송 시각을 기록한다. 마이그레이션은 기존 열이 `NOT NULL`인 경우에만 `NULL`을 허용하도록 변경한다. 이후 실제 가입 화면에서 첫 코드를 발송했고, 로컬 회귀 테스트로 기존 인증코드 행도 보존되는지 확인했다. [마이그레이션](../database/migrate.js)

회원 번호는 MySQL이 회원 행을 추가할 때 발급한다. 이메일 가입의 중복 확인과 코드 발송은 회원 번호를 발급하지 않는다. 코드를 확인한 뒤에 회원을 저장한다. 삽입 경쟁이나 트랜잭션 롤백으로 번호가 빌 수 있으며, 공유 DB에서 과거에 번호가 건너뛴 정확한 원인은 당시 기록이 필요하다. 기존 회원 번호는 권한·질문 등에서 참조한다.

## 6. Sequelize로 DB 수정하기

`models.js`가 테이블 매핑의 기준이다. 직접 SQL 파일과 query/execute 호출은 제거했다. `mysql2`는 Sequelize의 MySQL 드라이버로만 사용한다.

```javascript
// 조회: 조건과 반환 관계를 객체로 전달한다.
const user = await User.findByPk(userId);
// 저장: 매핑한 모델 속성으로 갱신한다.
await user.update({ nickname: nextNickname });
```

모델의 `User.nickname`은 기존 DB의 `name` 열에 `field: 'name'`으로 매핑된다. 화면과 API는 nickname을 쓴다. 기존 자료를 보존하기 위한 매핑이며 역할의 `Role.name`이나 강사 이름과는 다르다.

닉네임·아이디·이메일은 각각 고유하다. 꺼 둔 항목을 받지 않고 가입할 수 있도록 세 열은 NULL을 허용한다. NULL이 여러 개 있는 것은 중복 닉네임 사용과 다르다.

열을 추가할 때는 모델과 `database/migrate.js`의 QueryInterface 처리를 함께 수정한다. `sync()`는 없는 테이블·인덱스를 준비하지만 기존 열 변경을 모두 알아서 처리하지 않는다. `force:true`나 `alter:true`로 공유 DB를 재구성하지 않는다. 현재 마이그레이션은 열 존재 확인, 필요한 NULL 허용 변경, 중복 검사, 모델 동기화를 수행한다.

현재 모델은 users, roles, kakao_accounts, google_accounts, member_fields, courses, lectures, lecture_access, boards, questions, password_resets, signup_codes의 12개다. signup_codes에는 가입 전 인증 정보가 임시로 들어간다. 과거 `site_settings` 테이블이 DB에 남아 있어도 조회하지 않는다. 자료 보존을 위해 자동 삭제하지 않았다.

## 7. 회원 항목 스위치

관리자 → **회원 탭 → 회원가입·회원정보 항목 설정**에서 저장한다.

| 설정       | 서버·화면에서의 동작                                                                         |
| ---------- | -------------------------------------------------------------------------------------------- |
| ON         | 가입에 입력 필요, 수정·회원 조회 응답에서 사용                                               |
| OFF        | 입력 화면 제거, API로 보낸 값도 거절, 응답에서 제외                                          |
| 이메일 ON  | 신규 가입은 이메일 중복 확인과 인증코드 입력으로 진행                                        |
| 이메일 OFF | 신규 가입은 설정된 소셜 계정으로 인증. 기존 아이디 로그인 지원. 관리자 초기화 메일 버튼 숨김 |
| 아이디 OFF | 아이디 로그인 불가, 이메일 로그인 사용                                                       |

아이디 또는 이메일 하나는 켜 두어 비밀번호 로그인을 유지한다. 선택 목록과 상단 메뉴는 켜 둔 항목 중 기존 값이 있는 닉네임 → 아이디 → 이메일 순서로 표시한다. 표시할 값이 모두 비어 있을 때만 `회원 번호 14`처럼 표시한다. 이 문구는 화면에서 만들며 DB의 닉네임을 변경하지 않는다. 비밀번호·내부 회원 번호·역할·승인 상태는 항목 설정과 별도로 관리한다.

공개 회원 설정 API는 켜 둔 항목만 반환한다. 관리자 설정 화면에서는 끈 항목도 다시 켤 수 있다. 로그인 실패 응답은 입력한 값이 등록됐는지 또는 어느 항목이 꺼졌는지 밝히지 않는다. OFF로 바꿔도 기존 DB 값을 지우지는 않는다. 다시 ON이면 기존 값이 보이고, OFF 기간에 가입해 값이 없는 회원은 내 정보·관리자 수정에서 입력한다. 닉네임·아이디·이메일은 다른 회원의 값과 겹칠 수 없다. 가입과 수정은 같은 검증 함수를 사용한다.

설정 저장은 member_fields 세 행을 한 번에 갱신한다. 관리자 화면은 저장된 설정을 바로 반영하고 회원 목록을 다시 읽는다. 저장 요청이 거절되면 스위치는 마지막으로 읽은 설정으로 돌아간다. 저장에 성공한 뒤 회원 정보만 갱신하지 못한 경우에는 두 결과를 구분해 표시한다. 다른 브라우저는 화면 이동, 새로고침 또는 백그라운드 탭에 다시 돌아올 때 최신 설정을 읽는다.

관련 파일: `manager/member-fields.service.js`, `auth/account.js`, `user/service.js`, `client/src/shared/MemberFields.jsx`, `manager/MemberSettings.jsx`. 표시 순서는 [memberLabel.mjs](../client/src/shared/memberLabel.mjs)에서 고친다.

## 8. 회원가입·로그인·비밀번호 찾기

| 관리자 이메일 설정 | 학생이 회원가입에서 하는 일                                                | 계정이 생기는 시점                                      |
| ------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| 켬                 | 켜진 회원 항목과 비밀번호 입력 → 가입 인증코드 받기 → 받은 6자리 코드 입력 | 같은 브라우저에서 이메일과 코드를 검증하면 승인 대기    |
| 끔                 | 설정된 카카오·구글 중 하나로 인증 → 켜진 회원 항목 입력 → 가입 신청        | 서버가 인증한 소셜 계정을 학생에게 연결하면서 승인 대기 |

가입 화면은 [RegisterPage.jsx](../client/src/pages/RegisterPage.jsx), 이메일 가입은 [register.service.js](../src/modules/auth/register.service.js), 소셜 가입은 [social.service.js](../src/modules/auth/social.service.js)에서 수정한다. 학생을 승인하려면 관리자 → 회원 탭에서 해당 회원의 상태를 활성으로 바꾼다. 기존 회원은 내 정보에서 소셜 계정을 연결할 수 있다.

실제 회원가입 검증에서는 `/register`에서 코드를 요청하고 Gmail SMTP를 통해 수신한 6자리 코드를 같은 브라우저에 입력했다. 공유 DB에 `pending` 상태로 회원이 생성되었고 사용한 인증코드 행이 삭제된 것을 확인했다.

이메일 코드는 10분 동안 유효하다. 재발송은 60초 뒤에 가능하고 새 코드가 이전 코드를 대체한다. 같은 코드에 5번 틀리면 새 코드를 요청해야 한다. 가입 중 관리자가 이메일 스위치를 바꾸면 서버는 제출 시점의 정책을 적용한다.

카카오·구글도 우리 DB의 같은 역할·승인·정지 정책을 따른다. 신규 소셜 가입은 pending 학생이며 관리자가 승인해야 한다. 이메일이 같다는 이유로 기존 계정에 자동 연결하지 않는다. [공급자 설정](social-login.md)을 참고한다.

```text
기존 회원: 로그인 → 내 정보 → 카카오 또는 구글 연결
비밀번호 분실: 비밀번호 찾기 → 연결된 공급자로 인증
  → 서버에 5분 복구 세션 → 새 비밀번호 설정
  → 세션 버전 증가 → 기존 로그인 무효화 → 다시 로그인
```

공급자 ID·회원 ID·verified를 클라이언트가 임의로 보내도 복구 인증이 되지 않는다. 서버의 일회용 state, 연결 회원, active 상태, 세션 버전과 만료 시각을 검사한다. 구글은 PKCE도 사용한다. 계정 선택·카카오 인증은 공급자가 처리한다.

이메일 항목과 메일 발송 설정이 준비되면, 소셜 계정을 미리 연결하지 않은 회원은 관리자에게 초기화 메일을 요청할 수 있다. **아무 소셜 계정으로 인증하고 원하는 아이디의 비밀번호를 바꾸는 기능은 아니다.**

## 9. 비밀번호 저장·관리자 강제 초기화

`auth/password.js`의 PBKDF2-HMAC-SHA256은 비밀번호마다 임의 salt를 넣고 **600,000회** 반복 계산한다. 저장값에는 알고리즘·반복 횟수·salt·해시가 들어간다. 단순 해시를 몇 번 이어 붙이는 방식은 쓰지 않는다. [OWASP 권고](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)를 참고했다.

기존 scrypt 해시는 기존 비밀번호로 검증하고 성공한 로그인 때 새 저장 형식으로 갱신한다. 과거의 짧은 비밀번호도 이 이전 과정은 허용하지만, 새 가입·재설정은 8~128자만 받는다. 반복 횟수는 비밀번호 길이나 추측 용이성을 대신하지 않는다.

이메일 사용·발송 설정과 대상 회원 이메일이 준비되면 관리자 회원 탭에서 초기화 메일 발송 버튼으로 요청을 확인한다. 서버는 트랜잭션에서 기존 비밀번호를 임의 값으로 무효화하고 세션 버전을 증가시키며 30분짜리 토큰을 만든다. 토큰 원문은 메일에만 보내고 DB에는 SHA-256 해시를 저장한다. 메일 실패는 비밀번호·세션·토큰 변경을 롤백한다. 완료 토큰은 재사용할 수 없다.

가입 인증코드와 관리자 초기화 링크는 같은 발송 계정을 사용한다. 발신자는 MathSite 전용 Gmail, 수신자는 학생이 사이트에 입력한 이메일이다. 학생은 자기 메일함에서 6자리 코드만 확인한다. 메일을 보낼 개발 서버마다 해당 서버의 비공개 `.env`를 설정한다. 저장소와 배포 ZIP에는 설정 예시만 들어간다.

1. 팀에서 관리할 Gmail 계정을 만든다.
2. 그 계정에서 2단계 인증을 켜고 MathSite 서버용 앱 비밀번호를 발급한다. 이 설정은 발신 계정 담당자가 한 번 진행한다. [Google 앱 비밀번호 안내](https://support.google.com/accounts/answer/185833?hl=ko)
3. 서버의 비공개 `.env`에서 `SMTP_USER`와 `MAIL_FROM`에는 전용 Gmail 전체 주소를, `SMTP_PASSWORD`에는 앱 비밀번호를 입력한다. `MAIL_TRANSPORT=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`를 사용한다. 포트 587에서는 STARTTLS로 암호화한다. [Gmail SMTP 설정](https://support.google.com/mail/answer/7104828?hl=ko)
4. `APP_URL`을 사이트 주소로 설정하고 서버를 다시 실행한다. 회원가입 화면에서 받을 이메일을 입력해 실제 코드 수신을 확인한다.

이메일 항목을 끄면 새 메일 발송과 기존 메일 토큰의 비밀번호 변경 요청 모두 404로 응답하며 토큰·비밀번호·세션은 유지된다. 연결된 소셜 계정으로 하는 복구는 계속 사용할 수 있다. 이메일을 켠 상태에서 SMTP 미설정은 503, 실제 전송 실패는 502로 응답한다. Mocha는 테스트 전용 편지함과 모의 전송기를 사용한다.

## 10. 영상·Nginx

```text
관리자 업로드 → 관리자 검사·Multer·파일 서명 검사 → Lecture 저장
  → PROCESSING → FFmpeg H.264/AAC HLS 변환 → READY 또는 FAILED
학생 재생 → 현재 권한 검사 → 보호된 원본 또는 HLS 주소
각 재생 목록·영상 조각 → 다시 권한 검사 → Express 또는 Nginx 내부 전송
```

영상은 MySQL에 넣지 않는다. 원본은 `UPLOAD_DIR`, 변환 결과는 `HLS_DIR` 또는 `UPLOAD_DIR/hls`에 보관한다. DB는 경로 식별자·상태·권한을 저장한다. 온라인 DB를 공유해도 각 PC 영상 파일은 자동 공유되지 않는다.

이 PC 도구 경로:

```text
.local/tools/ffmpeg/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe
.local/tools/nginx/nginx-1.30.6/nginx.exe
```

새 PC는 [FFmpeg](https://ffmpeg.org/download.html), [Nginx](https://nginx.org/en/download.html)를 별도로 준비하고 FFMPEG_PATH, NGINX_PATH, NGINX_PORT를 설정한다. 실행 파일은 공유 ZIP에 넣지 않는다.

```powershell
npm.cmd run media:check
npm.cmd run media:start
# http://127.0.0.1:8080/
npm.cmd run media:stop
```

템플릿은 `server/nginx.conf.template`, 생성 설정은 `.local/nginx`다. 보호 폴더는 internal이므로 직접 열 수 없다. 업로드 제한은 MP4/WebM·250MiB다. 변환은 한 프로세스 안에서 순서대로 처리하며 서버 시작 시 PROCESSING 작업을 재등록한다. 공개 서비스의 분산 큐·DRM은 구현하지 않았다.

## 11. 검사와 연결 한도

```powershell
npm.cmd run db:start
npm.cmd test
npm.cmd run format:check
npm.cmd run db:stop
```

Mocha 통합 테스트 55개가 통과했다. 테스트는 로컬 `mathsite_test` 합성 자료를 재생성한다. `.env.local`의 DB_HOST는 localhost 또는 127.0.0.1이어야 하며 테스트가 DB_NAME을 mathsite_test로 강제한다. 테스트용 DB·권한·로컬 MySQL은 미리 준비한다. 새 PC에서는 자신의 MySQL 서비스로 켜도 된다. 이 PC의 db:start/stop은 전용 MySQL 경로와 `.local/mysql-admin.env`가 필요한 보조 도구다.

공유 DB 연결 장애 당시 서버 쪽에는 유휴 상태(`Sleep`)인 세션 5개가 열려 있었다. 해당 세션을 정리한 후 API가 다시 응답했고 실제 가입을 검증했다. 유휴 세션도 계정의 동시 접속 한도를 사용한다.

원격 DB의 연결 한도는 사람 수나 수정 횟수가 아니라 **열린 연결 수**다. Workbench 탭·SQL 편집기·각 PC의 Node 서버가 따로 사용할 수 있다. Sequelize 풀은 PC당 max=1, min=0이며 10초 유휴 후 정리 대상이 된다. DB의 동시 접속 한도에 도달하면 API가 503과 Retry-After 헤더를 보낸다. 시작 중 한도에 걸려도 화면 서버는 열린다. 이때 서버가 20초마다 한 번씩 DB 준비를 재시도하고, 성공하면 정상 API 처리를 시작한다. 재연결과 데이터 준비 중에는 각 단계가 표시된다. 화면의 조회 요청은 서버가 보낸 시간 뒤에 다시 시도하며, 등록·수정 요청은 자동 재전송하지 않는다. 사용하지 않는 본인의 Workbench 연결이나 개발 서버를 닫은 뒤 다시 시도한다. DB가 새 접속까지 거절하면, 소유자가 Filess의 Shared → 해당 DB → Overview → Quick Actions → Kill connections에서 기존 연결을 일괄 종료할 수 있다. 팀원 작업도 끊긴다. 종료 직후의 연결 수는 종료 전 사용자를 알려 주지 않는다.

## 12. 공유·미완료 범위

공유 ZIP은 코드·package-lock·공개 CA·시험용 영상·문서만 포함한다. `.env`, `.env.local`, `.local`, 실제 영상·DB 백업·node_modules·dist는 제외한다. DB 원본 백업은 회원정보와 인증 데이터를 포함하므로 개인 보관 위치에 두고 Git이나 팀 인수인계 ZIP에 포함하지 않는다. 비밀값은 비공개 전달 후 각 PC에서 입력한다.

외부 연결에서 남은 작업은 기존 중복 정리 후 닉네임 고유 인덱스 적용, Google OAuth 클라이언트 등록, 새 코드의 실제 카카오·구글 계정 인증 확인이다. 과거 카카오 실계정 연결 기록과 이번 공급자 응답 대체 검사는 구분한다. HTTPS 공개 배포·영구 세션 저장소·보고서 PDF·대면 회의 사진·제출은 팀의 후속 작업이다.
