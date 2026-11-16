import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { useAction } from './hooks';
import { api } from './api';
import PopupNotice from './PopupNotice';
import { memberLabel } from './memberLabel.mjs';

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

export function Page({ title, message, children }) {
    useEffect(() => {
        document.title = `${title} | MathSite`;
    }, [title]);
    return (
        <>
            <h2>{title}</h2>
            <p role="status">{message}</p>
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
