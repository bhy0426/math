const express = require('express');
const { query } = require('../../database');
const { requireLogin, requireAdmin, text, id, bool, fail } = require('../../shared/helpers');
const router = express.Router();
router.use(requireLogin);

async function getQuestion(value, user) {
    const [question] = await query('SELECT * FROM questions WHERE id = ?', [id(value)]);
    if (!question) fail(404, '질문이 없습니다.');
    if (!user.canManage && question.is_private && question.user_id !== user.id)
        fail(403, '비공개 질문입니다.');
    return question;
}

router.get('/qna', async (req, res) => {
    const questions = await query(
        `SELECT * FROM questions ${req.user.canManage ? '' : 'WHERE is_private = FALSE OR user_id = ?'} ORDER BY id DESC`,
        req.user.canManage ? [] : [req.user.id],
    );
    res.json({ questions });
});

router.post('/qna', async (req, res) => {
    const result = await query(
        'INSERT INTO questions (user_id, title, content, is_private) VALUES (?, ?, ?, ?)',
        [
            req.user.id,
            text(req.body.title, '질문 제목'),
            text(req.body.content, '질문 내용', 10000),
            req.body.isPrivate === undefined ? true : bool(req.body.isPrivate),
        ],
    );
    res.status(201).json({
        message: '질문 등록 완료',
        question: await getQuestion(result.insertId, req.user),
    });
});

router.get('/qna/:questionId', async (req, res) =>
    res.json({ question: await getQuestion(req.params.questionId, req.user) }),
);

router.patch('/qna/:questionId', async (req, res) => {
    const question = await getQuestion(req.params.questionId, req.user);
    if (question.user_id !== req.user.id) fail(403, '작성자만 질문을 수정할 수 있습니다.');
    const title = req.body.title === undefined ? question.title : text(req.body.title, '질문 제목');
    const content =
        req.body.content === undefined
            ? question.content
            : text(req.body.content, '질문 내용', 10000);
    const privateValue =
        req.body.isPrivate === undefined ? question.is_private : bool(req.body.isPrivate);
    await query('UPDATE questions SET title = ?, content = ?, is_private = ? WHERE id = ?', [
        title,
        content,
        privateValue,
        question.id,
    ]);
    res.json({ message: '질문 수정 완료', question: await getQuestion(question.id, req.user) });
});

router.delete('/qna/:questionId', async (req, res) => {
    const question = await getQuestion(req.params.questionId, req.user);
    if (question.user_id !== req.user.id && !req.user.canManage)
        fail(403, '작성자 또는 관리자만 삭제할 수 있습니다.');
    await query('DELETE FROM questions WHERE id = ?', [question.id]);
    res.json({ message: '질문 삭제 완료' });
});

router.post('/qna/:questionId/answer', requireAdmin, async (req, res) => {
    const question = await getQuestion(req.params.questionId, req.user);
    if (question.answer !== null) fail(409, '이미 답변이 있습니다. 수정 API를 사용하세요.');
    await query('UPDATE questions SET answer = ?, answered_by = ? WHERE id = ?', [
        text(req.body.answer, '답변', 10000),
        req.user.id,
        question.id,
    ]);
    res.status(201).json({
        message: '답변 등록 완료',
        question: await getQuestion(question.id, req.user),
    });
});

router.patch('/qna/:questionId/answer', requireAdmin, async (req, res) => {
    const question = await getQuestion(req.params.questionId, req.user);
    if (question.answer === null) fail(404, '등록된 답변이 없습니다.');
    await query('UPDATE questions SET answer = ?, answered_by = ? WHERE id = ?', [
        text(req.body.answer, '답변', 10000),
        req.user.id,
        question.id,
    ]);
    res.json({ message: '답변 수정 완료', question: await getQuestion(question.id, req.user) });
});

router.delete('/qna/:questionId/answer', requireAdmin, async (req, res) => {
    const question = await getQuestion(req.params.questionId, req.user);
    if (question.answer === null) fail(404, '등록된 답변이 없습니다.');
    await query('UPDATE questions SET answer = NULL, answered_by = NULL WHERE id = ?', [
        question.id,
    ]);
    res.json({ message: '답변 삭제 완료' });
});

module.exports = router;
