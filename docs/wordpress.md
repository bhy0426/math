# WordPress로 화면 내용 관리하기

화면은 지금처럼 React(`client/`)가 그린다. WordPress는 관리자 화면에서 **페이지 내용(제목·본문·이미지)** 을 편집하는 용도로만 쓴다(헤드리스 WordPress). 회원·강좌·시청 권한은 계속 Express와 MySQL이 맡는다.

## 주소 구성

이 PC에서는 Local 앱의 `mathsite` 사이트가 `http://mathsite.local`을 맡는다. nginx가 요청을 다음처럼 나눈다.

| 주소                                                                         | 처리                                           |
| ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `/`, `/courses`, `/manager` 등 화면, `/api/*`, `/auth/kakao`, `/auth/google` | Express(`127.0.0.1:3000`) → React 화면과 API   |
| `/wp-admin`, `/wp-login.php`                                                 | WordPress 관리자                               |
| `/wp-json/*`                                                                 | WordPress REST API(React가 페이지 내용을 읽음) |
| `/wp-content/*`, `/wp-includes/*`                                            | 업로드 이미지, 블록 기본 CSS                   |

nginx 설정은 Local 사이트 폴더의 `conf/nginx/site.conf.hbs`에 있다. Local에서 사이트를 시작할 때 이 파일로 설정을 만든다.

WordPress 테마는 [wordpress/theme](../wordpress/theme/functions.php)에 있다. Local 사이트의 `wp-content/themes/mathsite`는 이 폴더로 연결(junction)되어 있다. 테마는 화면을 그리지 않고, 처음 실행할 때 아래 페이지를 만들고 관리자 안내만 보여 준다.

## 화면과 페이지 연결

React 화면의 `<Page slug="...">`와 같은 **슬러그(고유주소)** 의 **공개** 페이지가 그 화면의 제목과 본문이 된다. 연결 코드는 [shared/wordpress.jsx](../client/src/shared/wordpress.jsx)와 [shared/components.jsx](../client/src/shared/components.jsx)의 `Page`다.

| 슬러그     | 화면                                   | 처음 상태             |
| ---------- | -------------------------------------- | --------------------- |
| `home`     | `/` 메인 (WordPress 홈페이지로도 지정) | 공개, 기존 React 문구 |
| `info`     | `/info` 학원 소개 · Q&A                | 공개, 기존 React 문구 |
| `courses`  | `/courses` 강좌 목록                   | 빈 초안               |
| `boards`   | `/boards` 공지사항                     | 빈 초안               |
| `login`    | `/login` 로그인                        | 빈 초안               |
| `register` | `/register` 회원가입                   | 빈 초안               |

- 페이지를 공개하면 제목이 화면 제목을 대신하고, 본문은 제목 아래·기능(폼, 목록) 위에 나온다.
- 초안·비공개로 바꾸거나 페이지를 지우면 코드에 적힌 기본 제목과 문구(`fallback`)가 나온다. WordPress에 연결하지 못할 때도 같다.
- 본문 안의 사이트 링크(`/courses` 등)는 페이지를 새로 불러오지 않고 React 화면으로 이동한다.
- 다른 화면에도 연결하려면 그 화면의 `<Page>`에 `slug`를 추가하고, 같은 슬러그로 페이지를 만든다.

## 편집 방법

1. `http://mathsite.local/wp-admin`에 WordPress 관리자 계정으로 로그인한다. MathSite 회원 계정과는 별개다.
2. **페이지**에서 수정할 페이지를 열어 블록 편집기로 고치고 **업데이트**를 누른다.
3. 사이트 화면을 새로고침하면 바로 반영된다.

## 실행

1. Local 앱에서 `mathsite` 사이트를 시작한다. WordPress, nginx, WordPress용 MySQL이 켜진다.
2. `math` 폴더에서 Express와 React 개발 서버를 실행한다.

    ```powershell
    npm.cmd run dev
    ```

3. 브라우저에서 `http://mathsite.local`을 연다.

개발 중 자동 새로고침(Vite HMR)은 Local 공용 라우터가 WebSocket을 넘기지 않아서 `127.0.0.1:3000`에 직접 연결한다([src/frontend.js](../src/frontend.js)).

## 주의

- 본문 HTML은 그대로 화면에 넣는다. 편집 권한은 신뢰하는 관리자에게만 준다.
- WordPress의 미리보기·글 화면은 사용하지 않는다. 사이트 주소는 모두 React 화면으로 간다.
- 배포할 때도 같은 도메인에서 위 표처럼 경로를 나눠야 한다. 그래야 React가 `/wp-json`을 같은 출처로 읽을 수 있다.
