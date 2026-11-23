const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { fail } = require('../../shared/helpers');
let loadedFile;
let loadedSender;

// 서버의 비공개 .local에 확인이 끝난 발신 계정 한 개만 보관한다.
function filename() {
    return path.resolve(process.env.MAIL_SETTINGS_FILE || '.local/mail-sender.json');
}

function encryptionKey() {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret === 'GENERATE_A_RANDOM_SECRET')
        fail(503, '발신 계정을 저장하려면 서버의 SESSION_SECRET을 설정하세요.');
    return crypto.hkdfSync('sha256', secret, '', 'MathSite mail sender v1', 32);
}

function readSender() {
    const target = filename();
    if (target === loadedFile) return loadedSender;
    let stored;
    try {
        stored = fs.readFileSync(target, 'utf8');
    } catch (error) {
        if (error.code !== 'ENOENT')
            fail(503, '발신 계정 설정 파일을 열 수 없습니다. 파일 권한을 확인하세요.');
        loadedFile = target;
        loadedSender = null;
        return null;
    }
    try {
        const { iv, tag, ciphertext } = JSON.parse(stored);
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            encryptionKey(),
            Buffer.from(iv, 'base64'),
        );
        decipher.setAuthTag(Buffer.from(tag, 'base64'));
        const content = Buffer.concat([
            decipher.update(Buffer.from(ciphertext, 'base64')),
            decipher.final(),
        ]);
        loadedSender = JSON.parse(content.toString('utf8'));
        loadedFile = target;
        return loadedSender;
    } catch {
        fail(
            503,
            '저장한 발신 계정을 읽을 수 없습니다. 서버 키를 확인하거나 메일을 다시 등록하세요.',
        );
    }
}

function writeSender(sender) {
    const target = filename();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(sender), 'utf8'),
        cipher.final(),
    ]);
    const record = {
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        ciphertext: encrypted.toString('base64'),
    };
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    const temporary = target + '.' + crypto.randomUUID() + '.tmp';
    try {
        fs.writeFileSync(temporary, JSON.stringify(record), { mode: 0o600, flag: 'wx' });
        fs.renameSync(temporary, target);
        loadedFile = target;
        loadedSender = sender;
    } finally {
        fs.rmSync(temporary, { force: true });
    }
}

module.exports = { readSender, writeSender };
