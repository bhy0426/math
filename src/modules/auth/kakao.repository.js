const crypto = require('node:crypto');
const { pool, query } = require('../../database');
const { fail, hashPassword } = require('../../shared/helpers');

async function findAccount(appKeyHash, kakaoId) {
    const [account] = await query(
        `SELECT u.id, u.status FROM kakao_accounts k
    JOIN users u ON u.id = k.user_id WHERE k.app_key_hash = ? AND k.kakao_id = ?`,
        [appKeyHash, kakaoId],
    );
    return account;
}

async function hasConnection(appKeyHash, userId) {
    const rows = await query(
        'SELECT user_id FROM kakao_accounts WHERE app_key_hash = ? AND user_id = ?',
        [appKeyHash, userId],
    );
    return rows.length > 0;
}

async function linkAccount(appKeyHash, kakaoId, userId) {
    const existing = await findAccount(appKeyHash, kakaoId);
    if (existing?.id === userId) return;
    if (existing) fail(409, '다른 회원에게 연결된 카카오 계정입니다.');
    await query('INSERT INTO kakao_accounts (app_key_hash, kakao_id, user_id) VALUES (?, ?, ?)', [
        appKeyHash,
        kakaoId,
        userId,
    ]);
}

async function registerAccount(identity, name, email) {
    // 카카오 전용 신규 회원의 이메일 비밀번호 로그인은 불가능한 임의 해시로 시작한다.
    const passwordHash = await hashPassword(crypto.randomBytes(48).toString('hex'));
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [[role]] = await connection.execute("SELECT id FROM roles WHERE code = 'student'");
        const [created] = await connection.execute(
            'INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
            [name, email, passwordHash, role.id],
        );
        await connection.execute(
            'INSERT INTO kakao_accounts (app_key_hash, kakao_id, user_id) VALUES (?, ?, ?)',
            [identity.appKeyHash, identity.kakaoId, created.insertId],
        );
        await connection.commit();
        return { id: created.insertId, name, email, status: 'pending' };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { findAccount, hasConnection, linkAccount, registerAccount };
