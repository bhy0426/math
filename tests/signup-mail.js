const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

// 실제 SMTP 대신 테스트 전용 편지함에서 사용자가 받을 코드를 읽는다.
async function openMailbox() {
    process.env.SIGNUP_MAIL_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'mathsite-signup-'));
}

async function closeMailbox() {
    const directory = process.env.SIGNUP_MAIL_DIR;
    if (
        directory &&
        path.dirname(directory) === os.tmpdir() &&
        path.basename(directory).startsWith('mathsite-signup-')
    )
        await fs.rm(directory, { recursive: true, force: true });
}

async function requestCode(request, body) {
    const before = new Set(await fs.readdir(process.env.SIGNUP_MAIL_DIR));
    const { password, code, ...fields } = body;
    const sent = await request('POST', '/auth/register/code', fields);
    assert.equal(sent.status, 200, sent.json?.message);
    const files = (await fs.readdir(process.env.SIGNUP_MAIL_DIR)).filter(
        (name) => !before.has(name),
    );
    assert.equal(files.length, 1);
    const mail = JSON.parse(
        await fs.readFile(path.join(process.env.SIGNUP_MAIL_DIR, files[0]), 'utf8'),
    );
    assert.equal(mail.email, fields.email.toLowerCase());
    assert.match(mail.code, /^\d{6}$/);
    assert.ok(
        !sent.bytes.includes(Buffer.from(mail.code)),
        '발급 응답에 인증 코드가 노출되면 안 된다',
    );
    return mail.code;
}

async function registerByEmail(request, body) {
    const code = await requestCode(request, body);
    return request('POST', '/auth/register', { ...body, code });
}

module.exports = { openMailbox, closeMailbox, requestCode, registerByEmail };
