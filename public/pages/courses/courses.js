import { $, api, link, run, say, requireUser } from '../../shared/common.js';
run(async () => {
    await requireUser();
    const courseId = location.pathname.match(/^\/courses\/(\d+)$/)?.[1];
    if (courseId) {
        const { course } = await api('GET', '/courses/' + courseId);
        $('title').textContent = course.title;
        $('description').textContent = course.description;
        for (const lecture of (await api('GET', `/courses/${courseId}/lectures`)).lectures) {
            const li = document.createElement('li');
            li.append(link(lecture.title, `/courses/${courseId}/lectures/${lecture.id}`));
            $('lectures').append(li);
        }
    } else {
        async function load() {
            const q = new FormData($('search')).get('q');
            const { courses } = await api('GET', '/courses?q=' + encodeURIComponent(q));
            $('courses').replaceChildren();
            for (const course of courses) {
                const li = document.createElement('li');
                li.append(link(course.title, '/courses/' + course.id));
                $('courses').append(li);
            }
            say(courses.length ? '' : '시청이 허용된 강좌가 없습니다. 관리자에게 문의하세요.');
        }
        $('search').onsubmit = run(load);
        await load();
    }
})();
