# 카카오 연결

공통 동작과 구글 설정은 [소셜 로그인 안내](social-login.md)를 본다.

2026-11-08 MathSite 전용 앱과 실제 카카오 로그인 연결을 확인한 기록이 있다. 2026-11-16에는 Sequelize·공통 인증 서비스·비밀번호 복구로 재구성했고 공급자 응답 대체 검사로 확인했다. **이번 변경의 실계정 로그인은 다시 확인하지 않았다.**

카카오 개발자 앱에서 로그인 사용을 활성화하고 REST API 키·활성화된 Client Secret을 서버 `.env`에 입력한다. 공식 복귀 주소는 다음과 정확히 일치시킨다.

```text
http://127.0.0.1:3000/auth/kakao/callback
```

KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET, KAKAO_REDIRECT_URI를 설정하고 서버를 다시 실행한다. `localhost`와 `127.0.0.1`은 다른 쿠키 호스트이므로 로그인 시작·연결·복귀는 같은 주소를 쓴다.

기존 회원은 로그인 → 내 정보 → 카카오 연결을 사용한다. 이메일이 꺼져 있으면 신규 회원은 카카오 인증 후 켜 둔 항목을 입력하고 관리자 승인을 기다린다. 이메일이 켜져 있으면 신규 회원은 이메일 인증코드로 가입한다.

비밀번호 찾기의 `/auth/kakao/recover`는 prompt=login으로 다시 인증하고, 기존 연결의 회원에게만 5분 복구 세션을 발급한다. 회원번호 원문은 서버에서 확인하며 브라우저 입력값을 신뢰하지 않는다. 토큰은 확인에만 사용하고 저장·노출하지 않는다.

공식 문서: [설정](https://developers.kakao.com/docs/ko/kakaologin/prerequisite), [REST API와 재인증](https://developers.kakao.com/docs/ko/kakaologin/rest-api).
