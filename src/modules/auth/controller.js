const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { query, pool } = require('../../database');
const { fail, text, email, hashPassword, verifyPassword } = require('../../shared/helpers');
const { loginSession } = require('./session');

function status(req, res) {
    return res.json({ loggedIn: Boolean(req.user), user: req.user || null });
}

async function register(req, res) {
    const name = text(req.body.name, '이름', 80);
    const address = email(req.body.email);
    const passwordHash = await hashPassword(req.body.password);
    const [role] = await query("SELECT id FROM roles WHERE code = 'student'");
    const result = await query(
        'INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
        [name, address, passwordHash, role.id],
    );
    res.status(201).json({
        message: '회원가입 완료. 관리자 승인 후 로그인할 수 있습니다.',
        user: { id: result.insertId, name, email: address, status: 'pending' },
    });
}

async function login(req, res) {
    const address = email(req.body.email);
    const [account] = await query(
        'SELECT id, password_hash, status, session_version FROM users WHERE email = ?',
        [address],
    );
    if (!account || !(await verifyPassword(req.body.password, account.password_hash)))
        fail(401, '이메일 또는 비밀번호를 확인하세요.');
    if (account.status !== 'active') fail(403, '관리자 승인이 필요하거나 정지된 계정입니다.');
    const user = await loginSession(req, account.id);
    res.json({ message: '로그인 완료', user });
}

async function logout(req, res) {
    await new Promise((resolve, reject) =>
        req.session.destroy((error) => (error ? reject(error) : resolve())),
    );
    res.clearCookie('mathsite.sid');
    res.json({ message: '로그아웃 완료' });
}

async function reset(req, res) {
    if (!req.body.token) {
        const address = email(req.body.email);
        const [account] = await query('SELECT id FROM users WHERE email = ?', [address]);
        if (account) {
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            await query(
                'INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE))',
                [tokenHash, account.id],
            );
            // 로컬 데모의 메일 대체 보관함. 토큰을 API 응답이나 로그로 반환하지 않는다.
            const directory = path.resolve(process.env.RESET_MAIL_DIR || '.local/reset-mail');
            await fs.mkdir(directory, { recursive: true });
            await fs.writeFile(
                path.join(directory, `${crypto.randomUUID()}.json`),
                JSON.stringify({ email: address, token }),
            );
        }
        return res.json({
            message:
                '등록된 이메일이면 재설정 안내가 준비됩니다. 로컬 데모는 .local/reset-mail을 확인하세요.',
        });
    }
    const token = text(req.body.token, '인증 토큰', 128);
    const passwordHash = await hashPassword(req.body.password);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.execute(
            'SELECT user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP() FOR UPDATE',
            [tokenHash],
        );
        if (!rows.length) fail(400, '유효하지 않거나 만료된 인증 토큰입니다.');
        await connection.execute(
            'UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?',
            [passwordHash, rows[0].user_id],
        );
        await connection.execute(
            'UPDATE password_resets SET used_at = UTC_TIMESTAMP() WHERE token_hash = ?',
            [tokenHash],
        );
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
    res.json({ message: '비밀번호 변경 완료. 다시 로그인하세요.' });
}

module.exports = { status, register, login, logout, reset };
