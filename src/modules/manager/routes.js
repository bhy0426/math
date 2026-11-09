const express = require('express');
const { query, pool } = require('../../database');
const { requireAdmin, text, id, fail, userSelect, publicUser } = require('../../shared/helpers');
const router = express.Router();
router.use(requireAdmin);

async function getUser(value) {
    const [user] = await query(`${userSelect} WHERE u.id = ?`, [id(value)]);
    if (!user) fail(404, '회원이 없습니다.');
    return publicUser(user);
}

async function changeUser(value, changes) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        // 동시에 두 관리자를 삭제해서 마지막 관리자가 사라지는 상황을 막는다.
        await connection.execute('SELECT id FROM users ORDER BY id FOR UPDATE');
        const [users] = await connection.execute(`${userSelect} WHERE u.id = ?`, [id(value)]);
        if (!users.length) fail(404, '회원이 없습니다.');
        const user = users[0];
        const [admins] = await connection.execute(
            "SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.can_manage = TRUE AND u.status = 'active'",
        );
        const removesAdmin =
            changes.remove ||
            (changes.status && changes.status !== 'active') ||
            (changes.role && !changes.role.can_manage);
        if (user.canManage && user.status === 'active' && removesAdmin && admins.length <= 1)
            fail(409, '마지막 관리자는 삭제·정지·역할 변경할 수 없습니다.');
        if (changes.remove) await connection.execute('DELETE FROM users WHERE id = ?', [user.id]);
        else if (changes.role)
            await connection.execute(
                'UPDATE users SET role_id = ?, session_version = session_version + 1 WHERE id = ?',
                [changes.role.id, user.id],
            );
        else
            await connection.execute(
                'UPDATE users SET status = ?, session_version = session_version + 1 WHERE id = ?',
                [changes.status, user.id],
            );
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

router.get('/users', async (req, res) =>
    res.json({ users: (await query(`${userSelect} ORDER BY u.id`)).map(publicUser) }),
);
router.get('/users/:userId', async (req, res) =>
    res.json({ user: await getUser(req.params.userId) }),
);
router.get('/users/:userId/role', async (req, res) => {
    const user = await getUser(req.params.userId);
    res.json({ userId: user.id, roleId: user.roleId, role: user.role, roleName: user.roleName });
});

router.patch('/users/:userId/role', async (req, res) => {
    const [role] = await query('SELECT * FROM roles WHERE id = ?', [id(req.body.roleId)]);
    if (!role) fail(404, '역할이 없습니다.');
    await changeUser(req.params.userId, { role });
    res.json({ message: '회원 역할 변경 완료', user: await getUser(req.params.userId) });
});

router.patch('/users/:userId/status', async (req, res) => {
    if (!['pending', 'active', 'suspended'].includes(req.body.status))
        fail(400, '상태는 pending, active, suspended 중 하나입니다.');
    await changeUser(req.params.userId, { status: req.body.status });
    res.json({ message: '회원 상태 변경 완료', user: await getUser(req.params.userId) });
});

router.delete('/users/:userId', async (req, res) => {
    await changeUser(req.params.userId, { remove: true });
    res.json({ message: '회원 삭제 완료' });
});

router.get('/', async (req, res) =>
    res.json({ roles: await query('SELECT * FROM roles ORDER BY id') }),
);
router.post('/', async (req, res) => {
    const code = text(req.body.code, '역할 코드', 40);
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(code))
        fail(400, '역할 코드는 영문 소문자·숫자·밑줄로 입력하세요.');
    const result = await query('INSERT INTO roles (code, name) VALUES (?, ?)', [
        code,
        text(req.body.name, '역할 이름', 80),
    ]);
    res.status(201).json({ message: '역할 추가 완료', roleId: result.insertId });
});
router.patch('/', async (req, res) => {
    const result = await query('UPDATE roles SET name = ? WHERE id = ?', [
        text(req.body.name, '역할 이름', 80),
        id(req.body.roleId),
    ]);
    if (!result.affectedRows) fail(404, '역할이 없습니다.');
    res.json({ message: '역할 이름 수정 완료' });
});
router.delete('/', async (req, res) => {
    const [role] = await query('SELECT * FROM roles WHERE id = ?', [id(req.body.roleId)]);
    if (!role) fail(404, '역할이 없습니다.');
    if (['admin', 'student'].includes(role.code)) fail(409, '기본 역할은 삭제할 수 없습니다.');
    await query('DELETE FROM roles WHERE id = ?', [role.id]);
    res.json({ message: '역할 삭제 완료' });
});

router.get('/users/:userId/lectures', async (req, res) => {
    await getUser(req.params.userId);
    const access = await query(
        `SELECT a.lecture_id, l.course_id, l.title, a.starts_at, a.expires_at,
    (a.starts_at <= UTC_TIMESTAMP() AND a.expires_at > UTC_TIMESTAMP()) AS valid
    FROM lecture_access a JOIN lectures l ON l.id = a.lecture_id WHERE a.user_id = ? ORDER BY l.id`,
        [id(req.params.userId)],
    );
    res.json({ access });
});

router.post('/users/:userId/lectures', async (req, res) => {
    const user = await getUser(req.params.userId);
    const lectureId = id(req.body.lectureId);
    const [lecture] = await query('SELECT id FROM lectures WHERE id = ?', [lectureId]);
    if (!lecture) fail(404, '강의가 없습니다.');
    const starts = req.body.startsAt ? new Date(req.body.startsAt) : new Date(Date.now() - 1000);
    const expires = req.body.expiresAt
        ? new Date(req.body.expiresAt)
        : new Date(Date.now() + 30 * 86400000);
    if (
        !Number.isFinite(starts.getTime()) ||
        !Number.isFinite(expires.getTime()) ||
        expires <= starts
    )
        fail(400, '유효한 시작일과 만료일을 입력하세요.');
    await query(
        `INSERT INTO lecture_access (user_id, lecture_id, starts_at, expires_at, granted_by) VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE starts_at = ?, expires_at = ?, granted_by = ?`,
        [user.id, lectureId, starts, expires, req.user.id, starts, expires, req.user.id],
    );
    res.status(201).json({
        message: '강의 시청 권한 부여 완료',
        userId: user.id,
        lectureId,
        startsAt: starts,
        expiresAt: expires,
    });
});

router.delete('/users/:userId/lectures/:lectureId', async (req, res) => {
    const result = await query('DELETE FROM lecture_access WHERE user_id = ? AND lecture_id = ?', [
        id(req.params.userId),
        id(req.params.lectureId),
    ]);
    if (!result.affectedRows) fail(404, '부여된 시청 권한이 없습니다.');
    res.json({ message: '강의 시청 권한 회수 완료' });
});

module.exports = router;
