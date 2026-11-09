export const $ = (id) => document.getElementById(id);
export const say = (text) => {
    $('message').textContent = text;
};
export const run = (action) => async (event) => {
    event?.preventDefault();
    try {
        await action(event);
    } catch (error) {
        say(error.message);
    }
};

export async function api(method, path, body) {
    const multipart = body instanceof FormData;
    const response = await fetch('/api' + path, {
        method,
        credentials: 'same-origin',
        headers: body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {},
        ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '요청에 실패했습니다.');
    return data;
}

export function link(text, href) {
    const a = document.createElement('a');
    a.textContent = text;
    a.href = href;
    return a;
}

export function options(select, items, label) {
    select.replaceChildren();
    for (const item of items) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = label(item);
        select.append(option);
    }
}

export function confirmRemoval(button, id) {
    if (button.dataset.remove !== String(id)) {
        button.dataset.remove = String(id);
        button.textContent = '한 번 더 눌러 삭제';
        return false;
    }
    delete button.dataset.remove;
    button.textContent = '삭제';
    return true;
}

export const session = api('GET', '/auth/status').then(({ user }) => {
    const heading = document.createElement('h1');
    heading.append(link('MathSite', '/'));
    const nav = document.createElement('nav');
    for (const [text, path] of [
        ['메인', '/'],
        ['소개·Q&A', '/info'],
        ['강좌', '/courses'],
        ['공지', '/boards'],
    ])
        nav.append(link(text, path));
    if (user) {
        nav.append(link(user.name + ' · 내 정보', '/user'));
        if (user.canManage) nav.append(link('관리자', '/manager'));
        const logout = document.createElement('button');
        logout.textContent = '로그아웃';
        logout.onclick = run(async () => {
            await api('POST', '/auth/logout');
            location.assign('/');
        });
        nav.append(logout);
    } else nav.append(link('로그인', '/login'));
    $('header').append(heading, nav);
    return user;
});

export async function requireUser(admin = false) {
    const user = await session;
    if (!user) {
        location.assign('/login');
        throw new Error('로그인이 필요합니다.');
    }
    if (admin && !user.canManage) throw new Error('관리자만 접근할 수 있습니다.');
    return user;
}
session.catch((error) => say(error.message));
