import { useState } from 'react';
import { useAuth } from '../shared/auth';
import { api } from '../shared/api';
import { useAction, useResource } from '../shared/hooks';
import { DeleteButton, Field, Form, Page } from '../shared/components';

export default function BoardsPage() {
    const { user } = useAuth();
    const [selectedId, setSelectedId] = useState(null);
    const [draftKey, setDraftKey] = useState(0);
    const boardPath = selectedId ? '/boards/' + selectedId : '/boards';
    const list = useResource('/boards');
    const detail = useResource(selectedId ? boardPath : null);
    const selected = detail.data?.board;
    const action = useAction();
    function reset() {
        setSelectedId(null);
        setDraftKey((value) => value + 1);
        list.reload();
    }
    function saveBoard(form) {
        const method = selected ? 'PATCH' : 'POST';
        const body = {
            title: form.get('title'),
            content: form.get('content'),
            popupEnabled: form.has('popupEnabled'),
            isPinned: form.has('isPinned'),
        };
        return action.run(() => api(method, boardPath, body), reset);
    }
    function deleteBoard() {
        return action.run(() => api('DELETE', boardPath), reset);
    }
    return (
        <Page title="공지사항" slug="boards" message={action.message || list.error || detail.error}>
            <ul>
                {list.data?.boards.map((board) => (
                    <li key={board.id}>
                        <button onClick={() => setSelectedId(board.id)}>{board.title}</button>
                    </li>
                ))}
            </ul>
            {selected && (
                <section>
                    <h3>{selected.title}</h3>
                    <p className="content">{selected.content}</p>
                </section>
            )}
            {user.canManage && (!selectedId || selected) && (
                <section>
                    <h3>공지 작성·수정</h3>
                    <Form
                        key={selectedId || `new-${draftKey}`}
                        busy={action.busy}
                        onSubmit={saveBoard}
                    >
                        <Field
                            label="제목"
                            name="title"
                            defaultValue={selected?.title || ''}
                            maxLength={160}
                            required
                        />
                        <Field
                            label="내용"
                            as="textarea"
                            name="content"
                            defaultValue={selected?.content || ''}
                            required
                        />
                        <button>저장</button>
                        <Field
                            label="공지 상단 고정"
                            name="isPinned"
                            type="checkbox"
                            defaultChecked={Boolean(selected?.is_pinned)}
                        />
                        <Field
                            label="로그인 시 팝업 표시 (최신 설정 공지 1개)"
                            name="popupEnabled"
                            type="checkbox"
                            defaultChecked={Boolean(selected?.popup_enabled)}
                        />
                        <button type="button" onClick={reset}>
                            새 공지
                        </button>
                        {selected && <DeleteButton key={selected.id} onDelete={deleteBoard} />}
                    </Form>
                </section>
            )}
        </Page>
    );
}
