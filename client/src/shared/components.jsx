import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { useAction } from './hooks';
import { api } from './api';
import PopupNotice from './PopupNotice';
import { memberLabel } from './memberLabel.mjs';
import { useReportWordPressSlug, useWordPressPage, WordPressContent } from './wordpress';

export function Layout({ children }) {
    const { user, setUser, fields, error } = useAuth();
    const viewer = user ? `${user.id}:${user.canManage}` : 'guest';
    const action = useAction();
    const navigate = useNavigate();
    return (
        <>
            <header>
                <h1>
                    <Link to="/">MathSite</Link>
                </h1>
                <nav>
                    <Link to="/">메인</Link>
                    <Link to="/info">소개·Q&A</Link>
                    <Link to="/courses">강좌</Link>
                    <Link to="/boards">공지</Link>
                    {user ? (
                        <>
                            <Link to="/user">{memberLabel(user, fields)} · 내 정보</Link>
                            {user.canManage && <Link to="/manager">학원 관리</Link>}
                            <button
                                disabled={action.busy}
                                onClick={() =>
                                    action.run(async () => {
                                        await api('POST', '/auth/logout');
                                        setUser(null);
                                        navigate('/');
                                    })
                                }
                            >
                                로그아웃
                            </button>
                        </>
                    ) : (
                        <Link to="/login">로그인</Link>
                    )}
                </nav>
                {(error || action.message) && <p role="status">{error || action.message}</p>}
            </header>
            <main key={viewer}>{children}</main>
            {user && <PopupNotice key={'popup:' + viewer} />}
        </>
    );
}

// slug가 있으면 WordPress 관리자에서 같은 슬러그로 공개한 페이지의 제목과 본문을 보여 준다.
// 페이지가 없거나 WordPress에 연결할 수 없으면 코드에 적힌 제목과 fallback을 보여 준다.
export function Page({ title, slug, fallback, message, children }) {
    const wordpress = useWordPressPage(slug);
    useReportWordPressSlug(slug);
    const page = wordpress.status === 'ready' ? wordpress.page : null;
    const heading = page?.title || title;
    useEffect(() => {
        document.title = `${heading} | MathSite`;
    }, [heading]);
    return (
        <>
            <h2>{heading}</h2>
            <p role="status">{message}</p>
            {page ? (
                <WordPressContent html={page.html} />
            ) : (
                ['missing', 'error'].includes(wordpress.status) && fallback
            )}
            {children}
        </>
    );
}

export function Field({ label, as: Control = 'input', children, ...props }) {
    return (
        <label>
            {label}
            <Control {...props}>{children}</Control>
        </label>
    );
}

export function Form({ onSubmit, busy, children, ...props }) {
    return (
        <form
            {...props}
            onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                onSubmit(new FormData(form, event.nativeEvent.submitter), form);
            }}
        >
            <fieldset disabled={busy}>{children}</fieldset>
        </form>
    );
}

export function DeleteButton({
    onDelete,
    children = '삭제',
    disabled,
    confirmLabel = '한 번 더 눌러 삭제',
}) {
    const [armed, setArmed] = useState(false);
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={async () => {
                if (!armed) return setArmed(true);
                await onDelete();
                setArmed(false);
            }}
        >
            {armed ? confirmLabel : children}
        </button>
    );
}
