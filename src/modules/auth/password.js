const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { fail } = require('../../shared/helpers');
const pbkdf2 = promisify(crypto.pbkdf2);
const scrypt = promisify(crypto.scrypt);
const ITERATIONS = 600000;

async function hashPassword(password, { legacyUpgrade = false } = {}) {
    // 과거 짧은 비밀번호의 로그인 검증을 통과한 경우에만 저장 형식을 갱신한다.
    if (
        typeof password !== 'string' ||
        password.length < (legacyUpgrade ? 1 : 8) ||
        password.length > 128
    )
        fail(400, '비밀번호는 8~128자여야 합니다.');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await pbkdf2(password, salt, ITERATIONS, 32, 'sha256');
    return `pbkdf2$sha256$${ITERATIONS}$${salt}$${hash.toString('hex')}`;
}

function needsRehash(saved) {
    return typeof saved !== 'string' || !saved.startsWith(`pbkdf2$sha256$${ITERATIONS}$`);
}

async function verifyPassword(password, saved) {
    if (typeof password !== 'string' || password.length > 128 || typeof saved !== 'string')
        return false;
    let actual, expected;
    if (saved.startsWith('pbkdf2$')) {
        const [algorithm, digest, rounds, salt, hash] = saved.split('$');
        if (
            algorithm !== 'pbkdf2' ||
            digest !== 'sha256' ||
            Number(rounds) !== ITERATIONS ||
            !/^[a-f0-9]{32}$/.test(salt || '') ||
            !/^[a-f0-9]{64}$/.test(hash || '')
        )
            return false;
        actual = await pbkdf2(password, salt, Number(rounds), 32, digest);
        expected = Buffer.from(hash, 'hex');
    } else {
        const [salt, hash] = saved.split(':');
        if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hash || '')) return false;
        actual = await scrypt(password, salt, 64);
        expected = Buffer.from(hash, 'hex');
    }
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyPassword, needsRehash, ITERATIONS };
