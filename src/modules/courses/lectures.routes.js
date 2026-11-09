const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const { query } = require('../../database');
const {
    requireAdmin,
    text,
    bool,
    id,
    fail,
    validAccess,
    getCourse,
    getLecture,
    publicLecture,
    uploadDir,
    videoPath,
    removeVideo,
} = require('../../shared/helpers');
const router = express.Router({ mergeParams: true });

fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
    storage: multer.diskStorage({
        destination: uploadDir,
        filename: (req, file, done) =>
            done(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
    }),
    limits: { fileSize: 250 * 1024 * 1024, files: 1, fields: 8 },
    fileFilter: (req, file, done) => {
        const extension = path.extname(file.originalname).toLowerCase();
        if (!['.mp4', '.webm'].includes(extension)) {
            const error = new Error('MP4 또는 WebM 영상만 업로드하세요.');
            error.status = 400;
            return done(error);
        }
        done(null, true);
    },
});

async function checkVideo(file) {
    if (!file) return null;
    const handle = await fs.promises.open(file.path, 'r');
    const header = Buffer.alloc(12);
    try {
        await handle.read(header, 0, header.length, 0);
    } finally {
        await handle.close();
    }
    if (file.filename.endsWith('.mp4') && header.toString('ascii', 4, 8) === 'ftyp')
        return 'video/mp4';
    if (
        file.filename.endsWith('.webm') &&
        header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    )
        return 'video/webm';
    fail(400, '파일 내용이 MP4/WebM 영상 형식과 일치하지 않습니다.');
}

router.use(async (req, res, next) => {
    req.course = await getCourse(req.params.courseId, req.user);
    next();
});

router.get('/', async (req, res) => {
    const access = req.user.canManage
        ? ''
        : ` AND l.is_published = TRUE AND EXISTS (
    SELECT 1 FROM lecture_access a WHERE a.lecture_id = l.id AND a.user_id = ? AND ${validAccess})`;
    const lectures = await query(
        `SELECT l.* FROM lectures l WHERE l.course_id = ?${access} ORDER BY l.position, l.id`,
        req.user.canManage ? [req.course.id] : [req.course.id, req.user.id],
    );
    res.json({ course: req.course.title, lectures: lectures.map(publicLecture) });
});

router.post('/', requireAdmin, upload.single('video'), async (req, res) => {
    let saved = false;
    try {
        const title = text(req.body.title, '강의 제목');
        const description = req.body.description
            ? text(req.body.description, '강의 설명', 10000)
            : '';
        const position = req.body.position === undefined ? 1 : id(req.body.position);
        const published = req.body.isPublished === undefined ? true : bool(req.body.isPublished);
        const mime = await checkVideo(req.file);
        const result = await query(
            'INSERT INTO lectures (course_id, title, description, position, is_published, video_file, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                req.course.id,
                title,
                description,
                position,
                published,
                req.file?.filename || null,
                mime,
            ],
        );
        saved = true;
        res.status(201).json({
            message: req.file
                ? '강의·영상 등록 완료'
                : '강의 등록 완료. 영상은 아직 등록되지 않았습니다.',
            lecture: publicLecture(await getLecture(req.course.id, result.insertId, req.user)),
        });
    } catch (error) {
        if (!saved) await removeVideo(req.file?.filename);
        throw error;
    }
});

router.patch('/:lectureId', requireAdmin, upload.single('video'), async (req, res) => {
    let saved = false;
    try {
        const lecture = await getLecture(req.course.id, req.params.lectureId, req.user);
        const title =
            req.body.title === undefined ? lecture.title : text(req.body.title, '강의 제목');
        const description =
            req.body.description === undefined
                ? lecture.description
                : text(req.body.description, '강의 설명', 10000);
        const position = req.body.position === undefined ? lecture.position : id(req.body.position);
        const published =
            req.body.isPublished === undefined ? lecture.is_published : bool(req.body.isPublished);
        const mime = req.file ? await checkVideo(req.file) : lecture.mime_type;
        await query(
            'UPDATE lectures SET title = ?, description = ?, position = ?, is_published = ?, video_file = ?, mime_type = ? WHERE id = ?',
            [
                title,
                description,
                position,
                published,
                req.file?.filename || lecture.video_file,
                mime,
                lecture.id,
            ],
        );
        saved = true;
        if (req.file) await removeVideo(lecture.video_file);
        res.json({
            message: '강의 수정 완료',
            lecture: publicLecture(await getLecture(req.course.id, lecture.id, req.user)),
        });
    } catch (error) {
        if (!saved) await removeVideo(req.file?.filename);
        throw error;
    }
});

router.delete('/:lectureId', requireAdmin, async (req, res) => {
    const lecture = await getLecture(req.course.id, req.params.lectureId, req.user);
    await query('DELETE FROM lectures WHERE id = ?', [lecture.id]);
    await removeVideo(lecture.video_file);
    res.json({ message: '강의 삭제 완료' });
});

router.post('/:lectureId/playback', async (req, res) => {
    const lecture = await getLecture(req.course.id, req.params.lectureId, req.user);
    if (!lecture.video_file) fail(409, '등록된 영상이 없습니다.');
    res.json({
        lecture: publicLecture(lecture),
        playbackUrl: `/api/courses/${req.course.id}/lectures/${lecture.id}`,
        message: '로컬 재생 주소입니다. 재생할 때도 로그인 세션과 현재 시청 권한을 확인합니다.',
    });
});

router.get('/:lectureId', async (req, res) => {
    const lecture = await getLecture(req.course.id, req.params.lectureId, req.user);
    if (req.query.info === '1') return res.json({ lecture: publicLecture(lecture) });
    if (!lecture.video_file) fail(409, '등록된 영상이 없습니다.');
    const filename = videoPath(lecture.video_file);
    let size;
    try {
        size = (await fs.promises.stat(filename)).size;
    } catch {
        fail(404, '영상 파일이 없습니다.');
    }
    let start = 0;
    let end = size - 1;
    if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!match || (!match[1] && !match[2]))
            return res.status(416).set('Content-Range', `bytes */${size}`).end();
        if (!match[1]) start = Math.max(0, size - Number(match[2]));
        else {
            start = Number(match[1]);
            if (match[2]) end = Math.min(Number(match[2]), size - 1);
        }
        if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start < 0 ||
            start > end ||
            start >= size
        ) {
            return res.status(416).set('Content-Range', `bytes */${size}`).end();
        }
        res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    res.set({
        'Content-Type': lecture.mime_type,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Cache-Control': 'private, no-store',
    });
    const stream = fs.createReadStream(filename, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
});

module.exports = router;
