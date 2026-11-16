const nodemailer = require('nodemailer');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fail } = require('../../shared/helpers');

function mailConfigured() {
    const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, MAIL_FROM, APP_URL } = process.env;
    if (!SMTP_HOST || !MAIL_FROM || !APP_URL) return false;
    if (SMTP_HOST.toLowerCase() === 'smtp.gmail.com') return Boolean(SMTP_USER && SMTP_PASSWORD);
    return Boolean(SMTP_USER) === Boolean(SMTP_PASSWORD);
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

async function deliver(email, subject, text, testDirectory, testMessage) {
    if (process.env.MAIL_TRANSPORT === 'file') {
        await fs.mkdir(testDirectory, { recursive: true });
        await fs.writeFile(
            path.join(testDirectory, `${crypto.randomUUID()}.json`),
            JSON.stringify(testMessage),
        );
        return;
    }
    const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        requireTLS: process.env.SMTP_SECURE !== 'true',
        ...(process.env.SMTP_USER
            ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }
            : {}),
        connectionTimeout: 10000,
        socketTimeout: 10000,
        disableFileAccess: true,
        disableUrlAccess: true,
    });
    try {
        await transport.sendMail({
            from: process.env.MAIL_FROM,
            to: email,
            subject,
            text,
        });
    } catch {
        fail(502, '메일 발송에 실패했습니다. 잠시 후 다시 시도하세요.');
    } finally {
        transport.close();
    }
}

module.exports = { sendReset, sendSignupCode, requireMail, mailConfigured, canSendResetEmail };
