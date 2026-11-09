const express = require('express');
const { query } = require('../../database');
const {
    requireLogin,
    requireAdmin,
    text,
    bool,
    id,
    fail,
    validAccess,
    getCourse,
    removeVideo,
} = require('../../shared/helpers');
const router = express.Router();
router.use(requireLogin);

router.use('/:courseId/lectures', require('./lectures.routes'));

router.get('/', async (req, res) => {
    const search = typeof req.query.q === 'string' ? req.query.q.slice(0, 160) : '';
    const access = req.user.canManage
        ? ''
        : ` AND c.is_published = TRUE AND EXISTS (
    SELECT 1 FROM lectures l JOIN lecture_access a ON a.lecture_id = l.id
    WHERE l.course_id = c.id AND l.is_published = TRUE AND a.user_id = ? AND ${validAccess})`;
    const courses = await query(
        `SELECT c.* FROM courses c WHERE c.title LIKE ?${access} ORDER BY c.id DESC`,
        req.user.canManage ? [`%${search}%`] : [`%${search}%`, req.user.id],
    );
    res.json({ courses });
});

router.post('/', requireAdmin, async (req, res) => {
    const title = text(req.body.title, '강좌명');
    const description = text(req.body.description, '강좌 설명', 10000);
    const teacher = req.body.teacher === undefined ? '' : text(req.body.teacher, '강사 이름', 80);
    const published = req.body.isPublished === undefined ? true : bool(req.body.isPublished);
    const result = await query(
        'INSERT INTO courses (title, description, teacher, is_published) VALUES (?, ?, ?, ?)',
        [title, description, teacher, published],
    );
    res.status(201).json({
        message: '강좌 등록 완료',
        course: await getCourse(result.insertId, req.user),
    });
});

router.get('/:courseId', async (req, res) =>
    res.json({ course: await getCourse(req.params.courseId, req.user) }),
);

router.patch('/:courseId', requireAdmin, async (req, res) => {
    const course = await getCourse(req.params.courseId, req.user);
    const title = req.body.title === undefined ? course.title : text(req.body.title, '강좌명');
    const description =
        req.body.description === undefined
            ? course.description
            : text(req.body.description, '강좌 설명', 10000);
    const teacher =
        req.body.teacher === undefined ? course.teacher : text(req.body.teacher, '강사 이름', 80);
    const published =
        req.body.isPublished === undefined ? course.is_published : bool(req.body.isPublished);
    await query(
        'UPDATE courses SET title = ?, description = ?, teacher = ?, is_published = ? WHERE id = ?',
        [title, description, teacher, published, course.id],
    );
    res.json({ message: '강좌 수정 완료', course: await getCourse(course.id, req.user) });
});

router.delete('/:courseId', requireAdmin, async (req, res) => {
    const files = await query('SELECT video_file FROM lectures WHERE course_id = ?', [
        id(req.params.courseId),
    ]);
    const result = await query('DELETE FROM courses WHERE id = ?', [id(req.params.courseId)]);
    if (!result.affectedRows) fail(404, '강좌가 없습니다.');
    await Promise.all(files.map((file) => removeVideo(file.video_file)));
    res.json({ message: '강좌 삭제 완료' });
});

router.patch('/:courseId/status', requireAdmin, async (req, res) => {
    const course = await getCourse(req.params.courseId, req.user);
    await query('UPDATE courses SET is_published = ? WHERE id = ?', [
        bool(req.body.isPublished),
        course.id,
    ]);
    res.json({ message: '강좌 공개 상태 변경 완료', course: await getCourse(course.id, req.user) });
});

module.exports = router;
