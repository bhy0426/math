const nodemailer = require('nodemailer');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fail } = require('../../shared/helpers');
const { readSender } = require('../manager/mail-sender.store');

// 발신자는 디스크에 암호화하고, 현재 서버에서 마지막으로 확인한 접속 결과만 메모리에 둔다.
const connections = new WeakMap();
const checksInFlight = new WeakMap();

function connectionState(sender) {
    if (!sender) return { connectionStatus: 'unregistered', checkedAt: null };
    return connections.get(sender) || { connectionStatus: 'unchecked', checkedAt: null };
}

function recordConnection(sender, connectionStatus, checkedAt = new Date().toISOString()) {
    connections.set(sender, { connectionStatus, checkedAt });
}

function failureStatus(error) {
    // SMTP 4xx는 인증 단계에서 발생해도 제공자가 재시도를 요청한 일시 장애다.
    if (error?.responseCode >= 400 && error.responseCode < 500) return 'unavailable';
    return error?.code === 'EAUTH' || error?.responseCode === 535 ? 'auth_failed' : 'unavailable';
}

function mailConfigured() {
    try {
        const sender = readSender();
        return Boolean(sender) && connectionState(sender).connectionStatus !== 'auth_failed';
    } catch (error) {
        if (error.status === 503) return false;
        throw error;
    }
}

function openSmtp(sender) {
    if (!sender) fail(503, '학원 관리에서 발신 계정을 등록하세요.');
    return nodemailer.createTransport({
        host: sender.email.endsWith('@naver.com') ? 'smtp.naver.com' : 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: sender.email, pass: sender.appPassword },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        disableFileAccess: true,
        disableUrlAccess: true,
    });
}

async function verifyConnection(sender) {
    const transport = openSmtp(sender);
    try {
        await transport.verify();
        recordConnection(sender, 'connected');
    } catch (error) {
        recordConnection(sender, failureStatus(error));
    } finally {
        transport.close();
    }
}

// 여러 관리자가 동시에 탭을 열어도 동일한 SMTP 인증 결과를 사용한다.
function checkConnection(sender) {
    if (!checksInFlight.has(sender)) {
        const check = verifyConnection(sender).finally(() => checksInFlight.delete(sender));
        checksInFlight.set(sender, check);
    }
    return checksInFlight.get(sender);
}

function canSendResetEmail() {
    if (process.env.MAIL_TRANSPORT === 'file')
        return (
            process.env.DB_NAME === 'mathsite_test' &&
            ['localhost', '127.0.0.1'].includes(process.env.DB_HOST)
        );
    return mailConfigured();
}

function requireMail(purpose = '비밀번호 재설정') {
    if (!canSendResetEmail())
        fail(503, `${purpose} 메일이 아직 준비되지 않았습니다. 관리자에게 문의하세요.`);
}

async function sendReset(email, token) {
    requireMail();
    const base = new URL(process.env.APP_URL || 'http://127.0.0.1:3000');
    if (!['http:', 'https:'].includes(base.protocol)) fail(500, '사이트 주소 설정을 확인하세요.');
    const url = new URL('/reset', base);
    url.searchParams.set('token', token);
    return deliver(
        email,
        'MathSite 비밀번호 재설정',
        `관리자가 기존 비밀번호와 로그인 상태를 초기화했습니다. 30분 안에 다음 주소에서 새 비밀번호를 설정하세요.\n${url.href}\n초기화 사유를 모르면 관리자에게 문의하세요.`,
        process.env.RESET_MAIL_DIR || '.local/reset-mail',
        { email, token, url: url.href },
    );
}

async function sendSignupCode(email, code) {
    requireMail('회원가입 인증');
    return deliver(
        email,
        'MathSite 회원가입 인증코드',
        `회원가입 인증코드는 ${code}입니다. 10분 안에 가입을 신청한 화면에 입력하세요.`,
        process.env.SIGNUP_MAIL_DIR || '.local/signup-mail',
        { email, code },
    );
}

async function sendSenderCode(sender, code) {
    return deliver(
        sender.email,
        'MathSite 발신 주소 등록',
        `발신 주소를 등록하려면 10분 안에 관리자 화면에 인증코드 ${code}를 입력하세요.`,
        process.env.SIGNUP_MAIL_DIR || '.local/test-sender-mail',
        { email: sender.email, code },
        sender,
    );
}

// 학생 안내 메일도 관리자가 메일함 인증을 마친 같은 발신 계정을 쓴다.
async function sendStudentMail(email, subject, body, expectedSender) {
    if (!expectedSender || readSender() !== expectedSender)
        fail(409, '발신 계정이 변경됐습니다. 발송 대상을 다시 확인하세요.');
    requireMail('학생 안내');
    return deliver(
        email,
        subject,
        body,
        process.env.BROADCAST_MAIL_DIR || '.local/test-broadcast-mail',
        {
            email,
            subject,
            body,
        },
    );
}

async function deliver(email, subject, text, testDirectory, testMessage, candidate) {
    if (process.env.MAIL_TRANSPORT === 'file') {
        if (!canSendResetEmail()) fail(503, '메일 전송 설정을 확인하세요.');
        await fs.mkdir(testDirectory, { recursive: true });
        await fs.writeFile(
            path.join(testDirectory, `${crypto.randomUUID()}.json`),
            JSON.stringify(testMessage),
        );
        return;
    }
    const sender = candidate || readSender();
    const transport = openSmtp(sender);
    try {
        await transport.sendMail({
            from: sender.email,
            to: email,
            subject,
            text,
        });
        recordConnection(sender, 'connected');
    } catch (error) {
        // 개별 수신자 거절은 발신 계정의 인증 장애로 표시하지 않는다.
        if (!['EENVELOPE', 'EMESSAGE'].includes(error?.code))
            recordConnection(sender, failureStatus(error));
        if (candidate)
            fail(
                502,
                '확인 메일을 보내지 못했습니다. 메일 제공자의 2단계 인증·앱 비밀번호·SMTP 설정을 확인하세요.',
            );
        const failure = new Error('메일 발송에 실패했습니다. 잠시 후 다시 시도하세요.');
        failure.status = 502;
        failure.expose = true;
        // 최종 SMTP 응답을 못 받았으면 이미 전달됐을 수도 있다.
        failure.deliveryUncertain =
            !error?.responseCode && !['EAUTH', 'EENVELOPE', 'EDNS'].includes(error?.code);
        throw failure;
    } finally {
        transport.close();
    }
}

module.exports = {
    sendReset,
    sendSignupCode,
    sendSenderCode,
    sendStudentMail,
    requireMail,
    connectionState,
    recordConnection,
    checkConnection,
    canSendResetEmail,
};
