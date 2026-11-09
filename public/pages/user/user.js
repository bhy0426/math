import { $, api, run, say, requireUser } from '../../shared/common.js';
run(async () => {
    const user = await requireUser();
    $('profile').elements.name.value = user.name;
    $('profile').elements.email.value = user.email;
    const status = await api('GET', '/auth/kakao/status');
    $('kakao-link').hidden = !status.configured || status.linked;
})();
$('profile').onsubmit = run(async (event) => {
    const data = await api('PATCH', '/user', Object.fromEntries(new FormData(event.target)));
    say(data.message);
});
