# 카카오·구글 로그인과 비밀번호 복구

2026-11-16. 두 공급자는 같은 `auth/social.service.js` 흐름을 사용하고 실제 통신·테이블 저장만 공급자별 파일로 나뉜다.

## Google Cloud 준비

사용자는 Google OAuth 앱이 아직 없다고 확인했다. 현재는 코드·설정 안내·대체 응답 테스트까지 완료했다. 키 없이 실제 구글 로그인이 된다고 표시하지 않는다.

1. [Google Cloud 콘솔](https://console.cloud.google.com/)에서 MathSite용 프로젝트를 선택하거나 준비한다.
2. Google Auth Platform에서 앱 이름·지원 이메일 등 동의 화면 정보를 설정한다. 테스트 상태라면 사용할 테스트 계정을 등록한다.
3. OAuth 클라이언트 유형을 **웹 애플리케이션**으로 준비한다.
4. 승인된 리디렉션 URI에 아래 주소를 정확히 등록한다.

```text
http://127.0.0.1:3000/auth/google/callback
```

5. 발급받은 값은 이 PC의 비공개 `.env`에만 입력한다.

```dotenv
GOOGLE_CLIENT_ID=본인_클라이언트_ID
GOOGLE_CLIENT_SECRET=본인_클라이언트_비밀값
GOOGLE_REDIRECT_URI=http://127.0.0.1:3000/auth/google/callback
```

6. DB 마이그레이션을 준비하고 서버를 재시작한다. 로그인 화면에서 구글 로그인 또는 내 정보에서 구글 연결을 확인한다.

현재 구현은 서버의 인가 코드 방식이며 openid 식별자만 요구한다. 서버가 토큰을 교환한 뒤 Google userinfo의 `sub`로 계정을 구분한다. 이메일·이름을 받아 기존 계정과 자동 병합하지 않는다. 직접 제출한 ID 토큰을 디코딩해서 인증으로 쓰는 경로는 없다. state·PKCE로 인증 시작과 callback을 연결하고 토큰은 DB·프론트·로그에 저장하지 않는다.

공식 문서: [웹 서버 OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [OpenID Connect와 sub](https://developers.google.com/identity/openid-connect/openid-connect).

## 공통 흐름

| 목적           | 시작 경로                                         | 결과                                                                    |
| -------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| 로그인         | `/auth/google` 또는 `/auth/kakao`                 | 연결 회원의 기존 역할·승인 상태로 로그인                                |
| 기존 회원 연결 | `/auth/google/link` 또는 `/auth/kakao/link`       | 로그인한 현재 회원에게만 연결                                           |
| 비밀번호 찾기  | `/auth/google/recover` 또는 `/auth/kakao/recover` | 연결된 활성 회원의 5분 복구 세션                                        |
| 추가 가입      | `POST /api/auth/{공급자}/register`                | 이메일 OFF에서 공급자 인증 후 현재 ON 항목을 입력해 승인 대기 학생 가입 |

설정·가입 필요·연결 여부는 `/api/auth/{공급자}/status`로 읽는다. 키·비밀값은 응답하지 않는다. 인증 시작·callback은 `/auth`와 `/api/auth` 별칭을 제공하지만 같은 구현이다.

이메일 ON일 때 미연결 계정으로 소셜 로그인을 시작하면 이메일 가입 화면으로 이동한다. 이메일 인증과 관리자 승인을 마친 뒤 내 정보에서 소셜 계정을 연결할 수 있다. 이미 연결한 계정의 소셜 로그인은 두 설정 모두에서 사용할 수 있다.

## 실계정 확인 순서

기존 회원으로 로그인 → 내 정보에서 공급자 연결 → 로그아웃 → 공급자 로그인으로 동일 회원인지 확인 → 로그아웃 → 비밀번호 찾기에서 같은 공급자 인증 → 새 비밀번호 설정 → 일반 로그인 확인.

미연결 소셜 계정은 다른 MathSite 회원의 비밀번호를 초기화할 수 없다. 연결이 없는 기존 회원은 관리자 메일 초기화로 복구한다. 이메일이 OFF면 메일 복구도 사용할 수 없으므로 소셜 연결을 미리 준비한다.

카카오는 [별도 설정](kakao-setup.md)을 본다. 현재 로컬 개발 기준이며 서비스 공개 시 HTTPS·실제 도메인 callback·영구 세션 저장소는 별도로 준비한다.
