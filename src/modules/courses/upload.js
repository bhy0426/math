const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const { uploadDir, fail } = require('../../shared/helpers');

fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
    storage: multer.diskStorage({
        destination: uploadDir,
        filename: (req, file, done) =>
            done(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
    }),
    limits: { fileSize: 250 * 1024 * 1024, files: 1, fields: 8 },
    fileFilter: (req, file, done) => {
        if (!['.mp4', '.webm'].includes(path.extname(file.originalname).toLowerCase())) {
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

module.exports = { upload, checkVideo };
