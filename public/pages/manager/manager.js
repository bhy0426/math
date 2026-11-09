import {
    $,
    api,
    run,
    say,
    options,
    link,
    requireUser,
    confirmRemoval,
} from '../../shared/common.js';
let courses = [];
run(async () => {
    await requireUser(true);
    $('management').hidden = false;

    async function members() {
        const rows = (await api('GET', '/manager/users')).users.filter((row) => !row.canManage);
        const states = { pending: '승인 대기', active: '승인', suspended: '정지' };
        options($('member'), rows, (row) => `${row.name} — ${states[row.status]}`);
        options(
            $('student'),
            rows.filter((row) => row.status === 'active'),
            (row) => row.name,
        );
    }
    async function lectures() {
        $('lectures').replaceChildren();
        const course = courses.find((row) => String(row.id) === $('course').value);
        if (!course) {
            $('course-form').reset();
            options($('lecture'), [], (row) => row.title);
            return;
        }
        for (const field of ['title', 'description', 'teacher'])
            $('course-form').elements[field].value = course[field];
        const rows = (await api('GET', `/courses/${course.id}/lectures`)).lectures;
        options($('lecture'), rows, (row) => row.title);
        for (const lecture of rows) {
            const li = document.createElement('li');
            li.append(link(lecture.title, `/courses/${course.id}/lectures/${lecture.id}`));
            const edit = document.createElement('details'),
                summary = document.createElement('summary'),
                form = document.createElement('form');
            summary.textContent = '강의 수정';
            edit.append(summary, form);
            for (const [name, label, type] of [
                ['title', '강의명', 'text'],
                ['description', '설명', 'text'],
                ['position', '순서', 'number'],
                ['video', '영상 교체', 'file'],
            ]) {
                const wrapper = document.createElement('label'),
                    input = document.createElement('input');
                wrapper.textContent = label;
                input.name = name;
                input.type = type;
                if (type === 'file') input.accept = 'video/mp4,video/webm';
                else input.value = lecture[name];
                if (name === 'title' || name === 'position') input.required = true;
                if (name === 'position') input.min = '1';
                wrapper.append(input);
                form.append(wrapper);
            }
            const save = document.createElement('button');
            save.textContent = '수정 저장';
            form.append(save);
            form.onsubmit = run(async () => {
                const data = new FormData(form);
                if (!data.get('video').size) data.delete('video');
                await api('PATCH', `/courses/${course.id}/lectures/${lecture.id}`, data);
                await lectures();
                say('강의 수정 완료');
            });
            const remove = document.createElement('button');
            remove.textContent = '삭제';
            remove.onclick = run(async () => {
                if (!confirmRemoval(remove, lecture.id)) return;
                await api('DELETE', `/courses/${course.id}/lectures/${lecture.id}`);
                await lectures();
                say('강의 삭제 완료');
            });
            li.append(edit, remove);
            $('lectures').append(li);
        }
    }
    async function load(preferredId) {
        courses = (await api('GET', '/courses')).courses;
        options($('course'), courses, (row) => row.title);
        if (courses.some((row) => String(row.id) === String(preferredId)))
            $('course').value = preferredId;
        await lectures();
    }
    function selectedCourse() {
        if (!$('course').value) throw new Error('강좌를 선택하세요.');
        return '/courses/' + $('course').value;
    }
    function courseBody() {
        const data = Object.fromEntries(new FormData($('course-form')));
        if (!data.teacher.trim()) delete data.teacher;
        return data;
    }
    $('course').onchange = run(lectures);
    $('course-form').onsubmit = run(async () => {
        await api('PATCH', selectedCourse(), courseBody());
        await load($('course').value);
        say('강좌 수정 완료');
    });
    $('add-course').onclick = run(async () => {
        if (!$('course-form').reportValidity()) return;
        const { course } = await api('POST', '/courses', courseBody());
        await load(course.id);
        say('강좌 추가 완료');
    });
    $('delete-course').onclick = run(async () => {
        const path = selectedCourse();
        if (!confirmRemoval($('delete-course'), path)) return;
        await api('DELETE', path);
        await load();
        say('강좌 삭제 완료');
    });
    $('lecture-form').onsubmit = run(async (event) => {
        await api('POST', selectedCourse() + '/lectures', new FormData(event.target));
        event.target.reset();
        await lectures();
        say('강의 업로드 완료');
    });
    for (const [button, status] of [
        ['approve', 'active'],
        ['suspend', 'suspended'],
    ])
        $(button).onclick = run(async () => {
            if (!$('member').value) throw new Error('회원을 선택하세요.');
            await api('PATCH', `/manager/users/${$('member').value}/status`, { status });
            await members();
            say('회원 상태 변경 완료');
        });
    for (const [button, method] of [
        ['grant', 'POST'],
        ['revoke', 'DELETE'],
    ])
        $(button).onclick = run(async () => {
            if (!$('student').value || !$('lecture').value)
                throw new Error('학생과 강의를 선택하세요.');
            const path = `/manager/users/${$('student').value}/lectures`;
            await api(
                method,
                path + (method === 'DELETE' ? '/' + $('lecture').value : ''),
                method === 'POST' ? { lectureId: Number($('lecture').value) } : undefined,
            );
            say(method === 'POST' ? '30일 시청 허용 완료' : '시청 권한 회수 완료');
        });
    await members();
    await load();
})();
