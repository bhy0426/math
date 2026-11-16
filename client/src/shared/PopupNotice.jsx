import { useEffect, useRef, useState } from 'react';
import { useResource } from './hooks';

export default function PopupNotice() {
    const { data } = useResource('/boards/popup');
    const dialog = useRef(null);
    const [closed, setClosed] = useState(false);
    const board = data?.board;
    const storageKey = board ? `mathsite-popup-${board.id}` : '';
    const day = new Date().toLocaleDateString();
    useEffect(() => {
        let dismissed = false;
        try {
            dismissed = localStorage.getItem(storageKey) === day;
        } catch {
            /* 저장 불가 시 이번 방문만 닫는다. */
        }
        if (board && !closed && !dismissed) dialog.current.showModal();
    }, [board, closed, storageKey, day]);
    if (!board) return null;
    function close(today) {
        if (today)
            try {
                localStorage.setItem(storageKey, day);
            } catch {
                /* 저장소가 차단된 브라우저 */
            }
        dialog.current.close();
        setClosed(true);
    }
    return (
        <dialog ref={dialog} aria-labelledby="popup-title" onCancel={() => setClosed(true)}>
            <h2 id="popup-title">{board.title}</h2>
            <p className="content">{board.content}</p>
            <button onClick={() => close(false)}>닫기</button>
            <button onClick={() => close(true)}>오늘 보지 않기</button>
        </dialog>
    );
}
