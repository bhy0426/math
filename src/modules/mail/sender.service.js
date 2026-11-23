const crypto = require('node:crypto');
const { email, fail } = require('../../shared/helpers');
const {
    sendSenderCode,
    connectionState,
    recordConnection,
    checkConnection,
} = require('./transport');
const { readSender, writeSender } = require('./sender.store');

const verificationLifetime = 10 * 60 * 1000;
const resendInterval = 60 * 1000;
// 한 사이트의 발신 주소는 한 개. 마지막으로 발송에 성공한 확인 건만 유효하다.
let pending;
let expiryTimer;
let sending = false;
let nextRequestAt = 0;
let emailSettingVersion = 0;

function clearPending() {
    clearTimeout(expiryTimer);
    pending = null;
}

function cancelVerification() {
    // 이미 SMTP에 전달한 요청도 이메일 설정이 꺼진 뒤에는 등록에 사용할 수 없다.
    emailSettingVersion++;
    clearPending();
}

function pendingFor(sessionId) {
    if (pending && pending.expiresAt <= Date.now()) clearPending();
    if (!pending || pending.sessionId !== sessionId) return null;
    return {
        email: pending.sender.email,
        verificationId: pending.id,
        expiresAt: new Date(pending.expiresAt).toISOString(),
    };
}

function status(sessionId) {
    let current;
    let warning = null;
    try {
        current = readSender();
    } catch (error) {
        if (error.status !== 503) throw error;
        warning = error.message;
    }
    return {
        sender: current?.email || null,
        source: current ? 'manager' : 'none',
        verifiedAt: current?.verifiedAt || null,
        ...connectionState(current),
        pending: pendingFor(sessionId),
        warning,
    };
}

async function check(sessionId) {
    const sender = readSender();
    if (!sender) fail(409, '먼저 발신 계정을 등록하세요.');
    const version = emailSettingVersion;
    await checkConnection(sender);
    if (version !== emailSettingVersion) fail(404, '등록되지 않은 API입니다.');
    if (readSender() !== sender) fail(409, '발신 계정이 변경됐습니다. 다시 확인하세요.');
    return status(sessionId);
}

function senderInput(body) {
    const address = email(body.email);
    if (!/^[a-z0-9][a-z0-9._-]*@(gmail\.com|naver\.com)$/.test(address))
        fail(400, 'Gmail 또는 네이버 메일 주소를 입력하세요.');
    if (typeof body.appPassword !== 'string' || body.appPassword.length > 128)
        fail(400, '메일 제공자가 발급한 앱 비밀번호를 입력하세요.');
    let password = body.appPassword.trim();
    if (address.endsWith('@gmail.com')) {
        password = password.replaceAll(' ', '');
        if (!/^[a-zA-Z0-9]{16}$/.test(password))
            fail(400, 'Google 앱 비밀번호 16자리를 입력하세요.');
    } else if (!password || /\s/.test(password)) {
        fail(400, '네이버에서 발급한 애플리케이션 비밀번호를 입력하세요.');
    }
    return { email: address, appPassword: password };
}

async function requestVerification(sessionId, body) {
    const sender = senderInput(body);
    if (sending || Date.now() < nextRequestAt)
        fail(429, '확인 메일은 1분 후에 다시 요청할 수 있습니다.');
    const code = String(crypto.randomInt(1000000)).padStart(6, '0');
    const version = emailSettingVersion;
    sending = true;
    nextRequestAt = Date.now() + resendInterval;
    try {
        await sendSenderCode(sender, code);
        if (version !== emailSettingVersion) fail(404, '등록되지 않은 API입니다.');
        clearPending();
        pending = {
            id: crypto.randomUUID(),
            sessionId,
            sender,
            checkedAt: new Date().toISOString(),
            codeHash: crypto.createHash('sha256').update(code).digest(),
            attempts: 0,
            expiresAt: Date.now() + verificationLifetime,
        };
        expiryTimer = setTimeout(clearPending, verificationLifetime);
        expiryTimer.unref();
        return { message: '새 발신 주소로 확인 메일을 보냈습니다.', ...pendingFor(sessionId) };
    } finally {
        sending = false;
    }
}

function confirm(sessionId, body) {
    const active = pendingFor(sessionId);
    if (!active || active.verificationId !== body.verificationId)
        fail(400, '유효한 확인 요청이 없습니다. 확인 메일을 다시 요청하세요.');
    const code = typeof body.code === 'string' ? body.code : '';
    const supplied = crypto.createHash('sha256').update(code).digest();
    if (!crypto.timingSafeEqual(pending.codeHash, supplied)) {
        pending.attempts++;
        if (pending.attempts >= 5) {
            clearPending();
            fail(429, '확인 횟수를 초과했습니다. 새 코드를 요청하세요.');
        }
        fail(400, '인증코드를 확인하세요.');
    }
    const sender = { ...pending.sender, verifiedAt: new Date().toISOString() };
    writeSender(sender);
    recordConnection(sender, 'connected', pending.checkedAt);
    clearPending();
    return { message: '새 발신 주소를 확인하고 저장했습니다.', ...status(sessionId) };
}

module.exports = { status, check, requestVerification, confirm, cancelVerification };
