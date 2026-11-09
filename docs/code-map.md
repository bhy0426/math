# 코드 읽는 순서와 파일 묶음

처음에는 **src/server.js → src/app.js → src/modules/courses/routes.js** 순서로 읽는다.

- server.js: DB를 확인하고 서버 실행
- app.js: 화면·기능 라우터 연결
- modules/기능/routes.js: 기능별 요청 처리

## 폴더 구조

```text
MathSite/
├─ src/                         백엔드
│  ├─ server.js                 실행 시작점
│  ├─ app.js                    공통 설정·라우터 연결
│  ├─ database.js               MySQL 연결
│  ├─ shared/helpers.js         공통 검증·암호·강의 접근 검사
│  ├─ middleware/               로그인 상태·요청 출처 검사
│  └─ modules/                  기능별 모듈
│     ├─ auth/                  이메일·카카오 인증
│     │  ├─ routes.js           이메일 인증 경로
│     │  ├─ controller.js       이메일 인증 처리
│     │  ├─ kakao.routes.js     카카오 인증 경로
│     │  ├─ kakao.controller.js 카카오 인증 흐름
│     │  ├─ kakao.config.js     서버 설정 읽기
│     │  ├─ kakao.client.js     카카오 서버 통신
│     │  ├─ kakao.repository.js 회원 연결 SQL
│     │  └─ session.js          공통 로그인 세션
│     ├─ courses/
│     │  ├─ routes.js           강좌
│     │  └─ lectures.routes.js  강좌 하위 강의·영상
│     ├─ boards/routes.js       공지
│     ├─ info/routes.js         Q&A
│     ├─ manager/routes.js      회원·권한 관리
│     └─ user/routes.js         내 정보
├─ public/                      프론트엔드
│  ├─ shared/                   공통 메뉴·API 호출·CSS
│  └─ pages/                    화면별 HTML·JS 묶음
│     ├─ home/                  메인
│     ├─ auth/                  로그인·추가 가입
│     ├─ user/                  내 정보
│     ├─ courses/               강좌 목록·상세·강의 시청
│     ├─ boards/                공지
│     ├─ info/                  소개·Q&A
│     └─ manager/               관리자
├─ database/schema.sql          DB 테이블 정의
├─ scripts/                     DB 시작·초기화 도구
├─ tests/                       Mocha 통합 테스트·합성 영상
├─ docs/                        코드·카카오 설정 설명
├─ package.json                 실행 명령·패키지
└─ .env.example                 비공개 설정의 입력 양식
```

## 수정할 곳

강좌 API는 src/modules/courses/routes.js, 강좌 화면은 public/pages/courses/를 수정한다. 공지·Q&A·회원·관리자도 같은 이름의 폴더에서 찾는다.

화면 주소는 /courses, /manager처럼 사용한다. JSON API는 /api/courses, /api/manager 아래에 있다. 카카오 복귀 주소 /auth/kakao/callback은 유지한다.

## 코드 정렬

공백 4칸과 LF 줄바꿈을 사용한다. 프로젝트 터미널에서 npm run format으로 정렬하고 npm run format:check로 확인한다. .prettierrc.json과 .editorconfig가 공통 규칙이다. .env, 비공개 데이터, 설치 패키지는 포맷 대상에서 제외한다.

## 테스트 코드

평가용 테스트는 Mocha로 작성한다. tests/api.test.js에서 일반 API 11개, tests/kakao.test.js에서 카카오 인증 7개를 확인한다. describe 안에 before → it → after 순서로 준비·검사·정리 코드를 읽으면 된다. npm test로 전체 실행한다.
