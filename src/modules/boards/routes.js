const express = require('express');
const { query } = require('../../database');
const { requireLogin, requireAdmin, text, id, bool, fail } = require('../../shared/helpers');
const router = express.Router();
router.use(requireLogin);

async function getBoard(value) {
    const [board] = await query('SELECT * FROM boards WHERE id = ?', [id(value)]);
    if (!board) fail(404, '공지가 없습니다.');
    return board;
}

router.get('/', async (req, res) => {
    const search = typeof req.query.q === 'string' ? req.query.q.slice(0, 160) : '';
    res.json({
        boards: await query(
            'SELECT * FROM boards WHERE title LIKE ? ORDER BY is_pinned DESC, id DESC',
            [`%${search}%`],
        ),
    });
});

router.post('/', requireAdmin, async (req, res) => {
    const result = await query('INSERT INTO boards (title, content, author_id) VALUES (?, ?, ?)', [
        text(req.body.title, '제목'),
        text(req.body.content, '내용', 10000),
        req.user.id,
    ]);
    res.status(201).json({ message: '공지 등록 완료', board: await getBoard(result.insertId) });
});

router.get('/:boardId', async (req, res) =>
    res.json({ board: await getBoard(req.params.boardId) }),
);

router.patch('/:boardId', requireAdmin, async (req, res) => {
    const board = await getBoard(req.params.boardId);
    const title = req.body.title === undefined ? board.title : text(req.body.title, '제목');
    const content =
        req.body.content === undefined ? board.content : text(req.body.content, '내용', 10000);
    await query('UPDATE boards SET title = ?, content = ? WHERE id = ?', [
        title,
        content,
        board.id,
    ]);
    res.json({ message: '공지 수정 완료', board: await getBoard(board.id) });
});

router.delete('/:boardId', requireAdmin, async (req, res) => {
    const result = await query('DELETE FROM boards WHERE id = ?', [id(req.params.boardId)]);
    if (!result.affectedRows) fail(404, '공지가 없습니다.');
    res.json({ message: '공지 삭제 완료' });
});

router.patch('/:boardId/pin', requireAdmin, async (req, res) => {
    const board = await getBoard(req.params.boardId);
    await query('UPDATE boards SET is_pinned = ? WHERE id = ?', [
        bool(req.body.isPinned),
        board.id,
    ]);
    res.json({ message: '공지 고정 상태 변경 완료', board: await getBoard(board.id) });
});

module.exports = router;
