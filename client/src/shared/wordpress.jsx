import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// WordPress 관리자에서 편집한 페이지 내용. 같은 주소(mathsite.local)의 /wp-json에서 읽는다.
// 공개된 페이지만 응답에 포함되므로 초안·비공개 페이지는 화면에 나오지 않는다.
const cache = new Map();

async function fetchPage(slug) {
    const response = await fetch(
        `/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&_fields=title,content`,
        { credentials: 'omit' },
    );
    if (!response.ok) throw new Error('WordPress 페이지를 불러오지 못했습니다.');
    const [page] = await response.json();
    if (!page) return null;
    return { title: decodeHtml(page.title.rendered), html: page.content.rendered };
}

function decodeHtml(text) {
    const element = document.createElement('textarea');
    element.innerHTML = text;
    return element.value;
}

// { status: 'loading' | 'ready' | 'missing' | 'error', page }
// 이전에 받은 내용이 있으면 먼저 보여 주고 최신 내용으로 바꾼다.
export function useWordPressPage(slug) {
    const [state, setState] = useState(() =>
        cache.has(slug) ? { slug, ...cache.get(slug) } : { slug, status: 'loading' },
    );
    useEffect(() => {
        if (!slug) return;
        let active = true;
        fetchPage(slug).then(
            (page) => {
                const next = page ? { status: 'ready', page } : { status: 'missing' };
                cache.set(slug, next);
                if (active) setState({ slug, ...next });
            },
            () => {
                if (active && !cache.has(slug)) setState({ slug, status: 'error' });
            },
        );
        return () => {
            active = false;
        };
    }, [slug]);
    if (!slug) return { status: 'missing' };
    return state.slug === slug ? state : { status: 'loading' };
}

// 페이지 본문 HTML. 사이트 안 링크는 React 화면 이동으로 처리한다.
// 본문은 WordPress 관리자(편집 권한자)가 작성한 내용만 표시한다.
export function WordPressContent({ html }) {
    const navigate = useNavigate();
    function onClick(event) {
        const link = event.target.closest('a');
        if (!link || link.target || event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin || /^\/wp-/.test(url.pathname)) return;
        event.preventDefault();
        navigate(url.pathname + url.search + url.hash);
    }
    return (
        <div className="wp-content" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
    );
}

// 지금 화면에 연결된 WordPress 페이지 슬러그. Page가 알려 주고 관리자 바가 읽는다.
const SlugContext = createContext({ slug: null, setSlug: () => {} });

export function useReportWordPressSlug(slug) {
    const { setSlug } = useContext(SlugContext);
    useEffect(() => {
        if (!slug) return;
        setSlug(slug);
        return () => setSlug(null);
    }, [slug, setSlug]);
}

// WordPress에 편집 권한으로 로그인한 브라우저에만 화면 위쪽에 관리자 바를 보여 준다.
// 로그인 여부는 WordPress 쿠키로 판단하며(테마의 mathsite_admin_bar), MathSite 회원 로그인과는 별개다.
export function WordPressAdminBar({ children }) {
    const [slug, setSlug] = useState(null);
    const [info, setInfo] = useState(null);
    const { pathname } = useLocation();
    useEffect(() => {
        let active = true;
        fetch(
            `/wp-admin/admin-ajax.php?action=mathsite_admin_bar&slug=${encodeURIComponent(slug || '')}`,
            { credentials: 'same-origin', cache: 'no-store' },
        )
            .then((response) => (response.ok ? response.json() : null))
            .then(
                (data) => active && setInfo(data?.loggedIn ? data : null),
                () => active && setInfo(null),
            );
        return () => {
            active = false;
        };
    }, [slug, pathname]);
    return (
        <SlugContext.Provider value={{ slug, setSlug }}>
            {info && (
                <nav className="wp-admin-bar" aria-label="WordPress 관리자">
                    <a href={info.dashboardUrl}>WordPress 관리자</a>
                    {slug && info.editUrl && (
                        <a href={info.editUrl}>
                            이 화면 문구 편집{info.pageStatus !== 'publish' && ' (공개 전)'}
                        </a>
                    )}
                    {slug && !info.editUrl && <a href={info.newPageUrl}>페이지 만들기</a>}
                    <a href={info.pagesUrl}>페이지 목록</a>
                    <span className="wp-admin-bar__user">
                        {info.name} · <a href={info.logoutUrl}>WordPress 로그아웃</a>
                    </span>
                </nav>
            )}
            {children}
        </SlugContext.Provider>
    );
}
