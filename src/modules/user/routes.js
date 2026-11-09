const express = require('express');
const { query } = require('../../database');
const { requireLogin, text, email, fail, userSelect, publicUser } = require('../../shared/helpers');
const router = express.Router();
router.use(requireLogin);

router.get('/', (req, res) => res.json({ user: req.user }));

router.patch('/', async (req, res) => {
    const fields = [];
    const values = [];
    if (Object.keys(req.body).some((key) => !['name', 'email'].includes(key)))
        fail(400, '이름과 이메일만 수정할 수 있습니다.');
    if (req.body.name !== undefined) {
        fields.push('name = ?');
        values.push(text(req.body.name, '이름', 80));
    }
    if (req.body.email !== undefined) {
        fields.push('email = ?');
        values.push(email(req.body.email));
    }
    if (!fields.length) fail(400, '수정할 이름 또는 이메일을 입력하세요.');
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...values, req.user.id]);
    const [user] = await query(`${userSelect} WHERE u.id = ?`, [req.user.id]);
    res.json({ message: '회원 정보 수정 완료', user: publicUser(user) });
});

module.exports = router;
