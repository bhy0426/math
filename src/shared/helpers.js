const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const { promisify } = require('node:util');
const { query } = require('../database');
const scrypt = promisify(crypto.scrypt);

function fail(status, message) {
    const error = new Error(message);
    error.status = status;
    throw error;
}

function text(value, label, max = 160) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
        fail(400, `${label}: 1~${max}자의 문자열을 입력하세요.`);
    }
    return value.trim();
}

function id(value) {
    if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
        fail(400, '올바른 ID를 입력하세요.');
    }
    return Number(value);
}

function bool(value) {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    fail(400, 'true 또는 false를 입력하세요.');
}

function email(value) {
    const result = text(value, '이메일', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400, '이메일 형식을 확인하세요.');
    return result;
}

async function hashPassword(password) {
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        fail(400, '비밀번호는 8~128자여야 합니다.');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await scrypt(password, salt, 64);
    return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password, saved) {
    if (typeof password !== 'string' || password.length > 128) return false;
    const [salt, hex] = saved.split(':');
    const actual = await scrypt(password, salt, 64);
    const expected = Buffer.from(hex, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const userSelect = `SELECT u.id, u.name, u.email, u.status, u.session_version,
  r.id AS roleId, r.code AS role, r.name AS roleName, r.can_manage AS canManage
  FROM users u JOIN roles r ON r.id = u.role_id`;

function publicUser(user) {
    const { session_version, ...safe } = user;
    return { ...safe, canManage: Boolean(safe.canManage) };
}

function requireLogin(req, res, next) {
    if (!req.user) return res.status(401).json({ message: '로그인이 필요합니다.' });
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ message: '로그인이 필요합니다.' });
    if (!req.user.canManage)
        return res.status(403).json({ message: '관리자만 사용할 수 있습니다.' });
    next();
}

const validAccess = 'a.starts_at <= UTC_TIMESTAMP() AND a.expires_at > UTC_TIMESTAMP()';

async function getCourse(courseId, user) {
    const [course] = await query('SELECT * FROM courses WHERE id = ?', [id(courseId)]);
    if (!course) fail(404, '강좌가 없습니다.');
    if (!user.canManage) {
        const rows = await query(
            `SELECT 1 FROM lectures l JOIN lecture_access a ON a.lecture_id = l.id
      WHERE l.course_id = ? AND l.is_published = TRUE AND a.user_id = ? AND ${validAccess} LIMIT 1`,
            [course.id, user.id],
        );
        if (!course.is_published || !rows.length) fail(403, '이 강좌에 접근할 권한이 없습니다.');
    }
    return course;
}

async function getLecture(courseId, lectureId, user) {
    await getCourse(courseId, user);
    const [lecture] = await query('SELECT * FROM lectures WHERE id = ? AND course_id = ?', [
        id(lectureId),
        id(courseId),
    ]);
    if (!lecture) fail(404, '해당 강좌의 강의가 아닙니다.');
    if (!user.canManage) {
        const rows = await query(
            `SELECT 1 FROM lecture_access a WHERE a.user_id = ? AND a.lecture_id = ? AND ${validAccess}`,
            [user.id, lecture.id],
        );
        if (!lecture.is_published || !rows.length) fail(403, '이 강의의 시청 권한이 없습니다.');
    }
    return lecture;
}

function publicLecture(lecture) {
    const { video_file, mime_type, ...safe } = lecture;
    return { ...safe, videoStatus: video_file ? 'READY' : 'NO_VIDEO' };
}

const uploadDir = path.resolve(process.env.UPLOAD_DIR || '.local/uploads');

function videoPath(filename) {
    if (!filename || path.basename(filename) !== filename)
        fail(400, '올바르지 않은 영상 경로입니다.');
    return path.join(uploadDir, filename);
}

async function removeVideo(filename) {
    if (!filename) return;
    try {
        await fs.unlink(videoPath(filename));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}

module.exports = {
    fail,
    text,
    id,
    bool,
    email,
    hashPassword,
    verifyPassword,
    userSelect,
    publicUser,
    requireLogin,
    requireAdmin,
    validAccess,
    getCourse,
    getLecture,
    publicLecture,
    uploadDir,
    videoPath,
    removeVideo,
};
