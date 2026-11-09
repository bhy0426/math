import { $, api, run, requireUser } from '../../shared/common.js';
run(async () => {
    await requireUser();
    const [, courseId, lectureId] = location.pathname.match(/^\/courses\/(\d+)\/lectures\/(\d+)$/);
    const { lecture, playbackUrl } = await api(
        'POST',
        `/courses/${courseId}/lectures/${lectureId}/playback`,
    );
    $('back').href = '/courses/' + courseId;
    $('title').textContent = lecture.title;
    $('description').textContent = lecture.description;
    $('player').src = playbackUrl;
})();
