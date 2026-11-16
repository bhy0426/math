const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { Lecture } = require('../../models');
const { fail, uploadDir, videoPath } = require('../../shared/helpers');

const hlsRoot = path.resolve(process.env.HLS_DIR || path.join(uploadDir, 'hls'));
let queue = Promise.resolve();
const jobs = new Map();

async function storedFile(filename) {
    try {
        const info = await fs.stat(filename);
        return info.isFile() ? info : null;
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
        throw error;
    }
}

function hlsPath(key, asset = '') {
    if (
        !/^[a-f0-9-]{36}$/.test(key || '') ||
        (asset && !/^(index\.m3u8|segment-\d{5}\.ts)$/.test(asset))
    )
        fail(400, '올바르지 않은 영상 주소입니다.');
    return path.join(hlsRoot, key, asset);
}

async function removeHls(key) {
    if (!key) return;
    const target = hlsPath(key);
    if (path.dirname(target) !== hlsRoot) fail(400, '영상 저장 경로를 확인하세요.');
    await fs.rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function runFfmpeg(input, directory, job) {
    return new Promise((resolve, reject) => {
        const child = spawn(
            process.env.FFMPEG_PATH || 'ffmpeg',
            [
                '-nostdin',
                '-hide_banner',
                '-loglevel',
                'error',
                '-y',
                '-protocol_whitelist',
                'file,pipe',
                '-i',
                input,
                '-map',
                '0:v:0',
                '-map',
                '0:a:0?',
                '-vf',
                'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                '-c:v',
                'libx264',
                '-preset',
                'fast',
                '-crf',
                '23',
                '-pix_fmt',
                'yuv420p',
                '-c:a',
                'aac',
                '-b:a',
                '128k',
                '-force_key_frames',
                'expr:gte(t,n_forced*6)',
                '-f',
                'hls',
                '-hls_time',
                '6',
                '-hls_playlist_type',
                'vod',
                '-hls_segment_filename',
                path.join(directory, 'segment-%05d.ts'),
                path.join(directory, 'index.m3u8'),
            ],
            { stdio: 'ignore', windowsHide: true },
        );
        job.child = child;
        const timer = setTimeout(() => child.kill(), 30 * 60 * 1000);
        child.once('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
        child.once('close', (code) => {
            clearTimeout(timer);
            code === 0 ? resolve() : reject(new Error('FFMPEG_FAILED'));
        });
    });
}

async function convert(lectureId, filename, job) {
    job.started = true;
    const key = crypto.randomUUID();
    try {
        const directory = hlsPath(key);
        await fs.mkdir(directory, { recursive: true });
        if (job.cancelled) return await removeHls(key);
        job.running = runFfmpeg(videoPath(filename), directory, job);
        await job.running;
        if (job.cancelled) return await removeHls(key);
        const current = await Lecture.findOne({ where: { id: lectureId, video_file: filename } });
        if (!current) return await removeHls(key);
        const [updated] = await Lecture.update(
            { video_status: 'READY', hls_key: key },
            { where: { id: lectureId, video_file: filename } },
        );
        if (!updated) return await removeHls(key);
        await removeHls(current.hls_key);
    } catch {
        await removeHls(key);
        if (job.cancelled) return;
        await Lecture.update(
            { video_status: 'FAILED' },
            { where: { id: lectureId, video_file: filename } },
        );
    }
}

async function queueConversion(lectureId, filename) {
    await cancelConversion(lectureId);
    await Lecture.update(
        { video_status: 'PROCESSING' },
        { where: { id: lectureId, video_file: filename } },
    );
    // 한 번에 하나만 변환한다. 요청 응답은 변환 완료까지 기다리지 않는다.
    const job = { lectureId, cancelled: false };
    const token = crypto.randomUUID();
    jobs.set(token, job);
    queue = queue
        .then(() => (job.cancelled ? undefined : convert(lectureId, filename, job)))
        .catch(() => {})
        .finally(() => jobs.delete(token));
    job.completion = queue;
}

async function cancelConversion(lectureId) {
    for (const job of jobs.values()) {
        if (job.lectureId !== lectureId) continue;
        job.cancelled = true;
        if (job.child) {
            job.child.kill();
        }
        if (job.started) await job.completion;
    }
}

async function resumeConversions() {
    const rows = await Lecture.findAll({ where: { video_status: 'PROCESSING' } });
    for (const row of rows) {
        // 공유 DB에는 다른 PC의 작업도 있다. 이 서버에서 원본을 읽을 수 있을 때만 복구한다.
        if (row.video_file && (await storedFile(videoPath(row.video_file))))
            await queueConversion(row.id, row.video_file);
    }
}

module.exports = {
    hlsRoot,
    hlsPath,
    storedFile,
    removeHls,
    queueConversion,
    cancelConversion,
    resumeConversions,
    waitForConversions: () => queue,
};
