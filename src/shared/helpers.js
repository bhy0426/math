const path = require('node:path');
const fs = require('node:fs/promises');

function fail(status, message) {
    const error = new Error(message);
    error.status = status;
    error.expose = true;
    throw error;
}

function text(value, label, max = 160) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
        fail(400, `${label}: 1~${max}자의 문자열을 입력하세요.`);
    return value.trim();
}

function id(value) {
    if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)
        fail(400, '올바른 ID를 입력하세요.');
    return Number(value);
}

function bool(value) {
    if ([true, 'true', 1, '1'].includes(value)) return true;
    if ([false, 'false', 0, '0'].includes(value)) return false;
    fail(400, 'true 또는 false를 입력하세요.');
}

function email(value) {
    const result = text(value, '이메일', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400, '이메일 형식을 확인하세요.');
    return result;
}

function username(value) {
    const result = text(value, '아이디', 40).toLowerCase();
    if (!/^[a-z][a-z0-9_]{3,39}$/.test(result))
        fail(400, '아이디는 영문 소문자로 시작하는 영문·숫자·밑줄 4~40자입니다.');
    return result;
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
    username,
    requireLogin,
    requireAdmin,
    uploadDir,
    videoPath,
    removeVideo,
};
