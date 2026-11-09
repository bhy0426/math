import { $, api, run, say, session } from '../../shared/common.js';

run(async () => {
    if (await session) return location.assign('/courses');
    const status = await api('GET', '/auth/kakao/status');
    $('register').hidden = !status.registrationRequired;
    const messages = {
        register: '이름·이메일을 입력하세요.',
        approval: '관리자 승인이 필요하거나 정지된 계정입니다.',
        cancelled: '카카오 로그인을 취소했습니다.',
    };
    const key = new URLSearchParams(location.search).get('kakao');
    if (messages[key]) say(messages[key]);
})();

$('login-form').onsubmit = run(async (event) => {
    await api('POST', '/auth/login', Object.fromEntries(new FormData(event.target)));
    event.target.reset();
    location.assign('/courses');
});
$('register-form').onsubmit = run(async (event) => {
    const data = await api(
        'POST',
        '/auth/kakao/register',
        Object.fromEntries(new FormData(event.target)),
    );
    event.target.reset();
    $('register').hidden = true;
    say(data.message);
});
