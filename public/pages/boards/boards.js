import { $, api, run, say, requireUser, confirmRemoval } from '../../shared/common.js';
let selected = null;
run(async () => {
    const user = await requireUser();
    $('editor').hidden = !user.canManage;
    async function load() {
        $('boards').replaceChildren();
        for (const board of (await api('GET', '/boards')).boards) {
            const li = document.createElement('li'),
                button = document.createElement('button');
            button.textContent = board.title;
            button.onclick = run(async () => {
                selected = (await api('GET', '/boards/' + board.id)).board;
                $('detail').hidden = false;
                $('title').textContent = selected.title;
                $('content').textContent = selected.content;
                $('board-form').elements.title.value = selected.title;
                $('board-form').elements.content.value = selected.content;
            });
            li.append(button);
            $('boards').append(li);
        }
    }
    $('board-form').onsubmit = run(async (event) => {
        const data = await api(
            selected ? 'PATCH' : 'POST',
            '/boards' + (selected ? '/' + selected.id : ''),
            Object.fromEntries(new FormData(event.target)),
        );
        selected = null;
        event.target.reset();
        $('detail').hidden = true;
        await load();
        say(data.message);
    });
    $('new-board').onclick = () => {
        selected = null;
        $('board-form').reset();
        $('detail').hidden = true;
    };
    $('delete-board').onclick = run(async () => {
        if (!selected || !confirmRemoval($('delete-board'), selected.id)) return;
        await api('DELETE', '/boards/' + selected.id);
        $('new-board').click();
        await load();
        say('공지 삭제 완료');
    });
    await load();
})();
