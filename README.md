# MathSite

Express + MySQL 기반 학원 사이트. 카카오·이메일 인증, 강좌·강의 영상, 학생별 시청 권한, 공지, Q&A를 기능별로 나눈다.

## 실행

현재 개발 DB는 Filess.io의 무료 공유형 MySQL에 연결되어 있다. 각자 같은 DB에 연결하고 웹 서버는 자신의 PC에서 실행한다.

```powershell
npm.cmd ci
npm.cmd start
```

http://127.0.0.1:3000/ 에서 메인페이지를 연다. 상태 API는 /health, 로그인 상태 API는 /api/auth/status다.

| 화면                    | 주소                                     |
| ----------------------- | ---------------------------------------- |
| 메인                    | `/`                                      |
| 로그인·카카오 추가 가입 | `/login`                                 |
| 내 정보                 | `/user`                                  |
| 소개·Q&A                | `/info`                                  |
| 강좌 목록               | `/courses`                               |
| 강좌 상세·강의 목록     | `/courses/:courseId`                     |
| 강의 시청               | `/courses/:courseId/lectures/:lectureId` |
| 공지사항                | `/boards`                                |
| 관리자                  | `/manager`                               |

새 PC에서는 Node.js를 설치하고 `.env.example`을 `.env`로 복사한 뒤 팀의 DB 연결 정보를 입력한다. 온라인 DB를 사용할 때는 MySQL을 별도로 설치하지 않아도 된다. 연결 비밀번호는 Git·공개 채팅에 올리지 않는다.

이 PC의 기존 로컬 DB는 보존했다. `db:start`·`db:stop`은 `.env.local`의 로컬 전용 설정을 사용한다.

## 최초 관리자

새 DB에 회원이 없을 때 .env의 ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD를 설정하고 db:init을 실행하면 최초 관리자 계정을 만든다. 기존 회원·강좌·권한은 덮어쓰지 않는다. 일반 초기화는 예제 학생·강좌·영상을 생성하지 않는다.

## 로그인과 권한

- 카카오 로그인 → 신규 회원은 이름·이메일 입력 → 관리자 승인 대기.
- 기존 이메일 회원은 로그인 후 본인 계정에 카카오를 연결한다.
- 관리자가 회원 승인과 강의별 시청 권한을 각각 부여한다.
- 학생은 허용된 강의만 시청하고, 관리자는 강좌·강의 등록·수정·삭제와 회원 권한을 관리한다.
- 화면 표시와 별도로 서버가 매 요청의 계정 상태와 강의 권한을 검사한다.

2026-11-08 전용 카카오 앱 MathSite(ID 1641477) 등록, 로그인 활성화, 로컬 복귀 주소 등록과 서버 키 설정을 완료했다. 실제 카카오 인증 후 사이트 관리자 세션으로 로그인하고 강좌·관리 화면이 표시되는 것을 확인했다. [카카오 연결 설정](docs/kakao-setup.md)을 참고한다. 실제 키는 .env에만 저장한다.

## 코드 구조

[파일별 역할](docs/code-map.md)을 참고한다. src/app.js는 라우터를 연결한다. src/modules는 auth·courses·boards·info·manager·user처럼 기능별로 묶고, 해당 기능의 경로·처리·설정·통신·SQL 파일을 함께 둔다. 실행 시작점은 src/server.js다. config·middleware·db도 분리되어 있다.

public/pages에는 화면별 HTML·JS를 같은 폴더에 묶었다. public/shared/common.js는 메뉴·세션·API 호출을 공유하며 public/shared/style.css는 기본 서식만 담당한다. 강좌·시청 화면과 관리자 화면은 서로 다른 페이지다. 프론트 빌드 도구와 프레임워크는 사용하지 않는다.

## API 범위

- /api/auth, /api/auth/kakao: 인증 API. 카카오 브라우저 인증 시작·복귀 주소는 기존 /auth/kakao 경로를 유지한다.
- /api/user: 내 정보.
- /api/manager: 회원 승인·정지·역할·개별 강의 시청 권한.
- /api/courses: 강좌 CRUD·공개 상태.
- /api/courses/:courseId/lectures: 강의 CRUD·업로드·세션 재생 주소 발급·Range 스트리밍.
- /api/boards: 공지 CRUD·고정.
- /api/info/qna: 질문 CRUD·작성자 확인·비공개·관리자 답변.

평가 대상 라우터는 info 8개, courses 6개, lectures 6개, boards 6개다. 소개·Q&A, 공지, 내 정보도 개별 기본 화면을 제공한다. 비밀번호 재설정은 API만 있다.

## 테스트

평가 기준에 맞춰 **Mocha**를 사용한다. `describe`는 테스트 묶음, `it`는 검사 항목, `before`·`after`는 준비·정리 단계다. 결과 비교는 Node 기본 `assert`로 한다.

```powershell
npm.cmd test
```

API 테스트 11개와 카카오 테스트 7개, 총 18개를 실행한다. 각각 실행하려면 `npm run test:api`, `npm run test:kakao`를 사용한다. 두 묶음의 DB 연결·환경 설정이 섞이지 않도록 별도 프로세스에서 순서대로 실행한다.

테스트는 `.env.local`에 지정한 로컬 MySQL의 `mathsite_test` 전용 DB에서만 실행한다. 온라인 개발 DB 설정인 `.env`와 분리하므로 공유 데이터가 테스트로 삭제되지 않는다. 새 PC에서 테스트하려면 로컬 MySQL에 `mathsite_test` DB와 해당 DB 접근 계정을 준비하고, `.env.example`을 `.env.local`로 복사해 그 연결 정보를 입력한다.

합성 계정·영상을 만들고 실제 HTTP·SQL로 테스트한다. 카카오 공급자 응답만 대체하며 실제 카카오 로그인 성공 시험과는 구분한다. tests/fixtures/sample.mp4와 tests/seed.js는 테스트용이다.

## 온라인 MySQL 연결 설정

2026-11-09 Filess.io 무료 공유형 DB 생성과 기존 데이터 이전을 완료했다. 실제 엔진은 **MySQL 5.7.38-41-log**다. MySQL 8.0 무료 서버는 생성 시 용량 부족으로 거절되어 5.7 서버를 사용했다. 5.7은 오래된 버전이므로 기말 프로젝트 공동개발 용도로 사용하고, 운영 배포 시에는 지원 중인 버전으로 이전한다.

`.env`의 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`에 발급받은 연결 정보를 입력한다. TLS 연결은 `DB_SSL=true`로 설정한다. 제공업체가 별도 CA 인증서를 제공하면 `DB_SSL_CA`에 인증서 파일 경로를 입력한다. 인증서 검증은 항상 유지한다.

현재 연결 값은 `DB_PORT=3306`, `DB_SSL=true`, `DB_SSL_CA=database/certs/filess-ca.pem`, `DB_CONNECTION_LIMIT=1`이다. `database/certs/filess-ca.pem`은 최초 TLS 연결에서 받은 서버 CA를 고정한 공개 인증서이며 비밀번호가 아니다. 외부의 별도 경로로 지문을 검증하지는 않았다. 인증서가 변경되면 연결을 거절하므로 제공업체의 변경 여부를 확인한 뒤 갱신한다. 인증서 검증을 끄는 설정은 사용하지 않는다.

무료 플랜은 DB당 10MB이며 팀 전체 동시 연결 수 제한은 5개다. 각자 `DB_CONNECTION_LIMIT=1`로 사용하고 불필요한 DB 관리 도구 연결은 닫는다. `.env`와 `.env.local`은 Git·ZIP으로 공유하지 않는다.

영상 파일은 `.local/uploads`에 따로 저장한다. 온라인 DB를 공유해도 영상 파일은 다른 PC에 자동 복사되지 않는다.

## 현재 구성

서버는 127.0.0.1에서 실행하고 개발 DB는 Filess.io에 있다. 로그인 세션은 메모리에 있어 서버를 재시작하면 다시 로그인한다. 영상은 MP4/WebM 원본을 전달한다. 비밀번호 재설정은 비공개 로컬 보관함을 사용한다. 카카오 채널·실제 이메일 발송·외부 영상 서비스·모듈 ON/OFF는 아직 연결하지 않았다.

.env, .local, node_modules와 실제 DB 데이터·인증키는 Git이나 공유 파일에 포함하지 않는다.

## 들여쓰기·포맷

공백 4칸으로 통일한다. 전체 정렬은 `npm run format`, 검사만 할 때는 `npm run format:check`를 실행한다. 설정은 `.prettierrc.json`, `.editorconfig`, `.vscode/settings.json`에 있다.
