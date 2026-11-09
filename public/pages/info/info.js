import { $, api, run, say, session, confirmRemoval } from '../../shared/common.js';
let selected = null;
run(async () => {
    const user = await session;
    $('guest').hidden = Boolean(user);
    $('qna').hidden = !user;
    if (!user) return;

    function reset() {
        selected = null;
        $('question-form').reset();
        $('question-form').elements.title.readOnly = false;
        $('question-form').elements.content.readOnly = false;
        $('question-form').elements.isPrivate.disabled = false;
        $('save-question').hidden = false;
        $('delete-question').hidden = true;
        $('answer').textContent = '';
        $('answer-form').hidden = true;
        $('question-heading').textContent = '질문 작성';
    }
    async function show(questionId) {
        selected = (await api('GET', '/info/qna/' + questionId)).question;
        const own = selected.user_id === user.id,
            form = $('question-form').elements;
        form.title.value = selected.title;
        form.content.value = selected.content;
        form.isPrivate.checked = Boolean(selected.is_private);
        form.title.readOnly = !own;
        form.content.readOnly = !own;
        form.isPrivate.disabled = !own;
        $('save-question').hidden = !own;
        $('delete-question').hidden = !own && !user.canManage;
        $('question-heading').textContent = '질문 상세';
        $('answer').textContent = selected.answer || '등록된 답변이 없습니다.';
        $('answer-form').hidden = !user.canManage;
        $('answer-form').elements.answer.value = selected.answer || '';
    }
    async function load() {
        $('questions').replaceChildren();
        for (const question of (await api('GET', '/info/qna')).questions) {
            const li = document.createElement('li'),
                button = document.createElement('button');
            button.textContent = question.title;
            button.onclick = run(() => show(question.id));
            li.append(button);
            $('questions').append(li);
        }
    }
    $('question-form').onsubmit = run(async (event) => {
        const form = event.target.elements;
        const data = await api(
            selected ? 'PATCH' : 'POST',
            '/info/qna' + (selected ? '/' + selected.id : ''),
            {
                title: form.title.value,
                content: form.content.value,
                isPrivate: form.isPrivate.checked,
            },
        );
        reset();
        await load();
        say(data.message);
    });
    $('new-question').onclick = reset;
    $('delete-question').onclick = run(async () => {
        if (!selected || !confirmRemoval($('delete-question'), selected.id)) return;
        await api('DELETE', '/info/qna/' + selected.id);
        reset();
        await load();
        say('질문 삭제 완료');
    });
    $('answer-form').onsubmit = run(async (event) => {
        const data = await api(
            selected.answer === null ? 'POST' : 'PATCH',
            `/info/qna/${selected.id}/answer`,
            { answer: event.target.elements.answer.value },
        );
        await show(selected.id);
        say(data.message);
    });
    $('delete-answer').onclick = run(async () => {
        if (
            !selected ||
            selected.answer === null ||
            !confirmRemoval($('delete-answer'), selected.id)
        )
            return;
        await api('DELETE', `/info/qna/${selected.id}/answer`);
        await show(selected.id);
        say('답변 삭제 완료');
    });
    await load();
})();
