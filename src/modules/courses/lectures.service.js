const fs = require('node:fs');
const { Op } = require('sequelize');
const { Lecture, LectureAccess } = require('../../models');
const { text, bool, id, fail, removeVideo, videoPath } = require('../../shared/helpers');
const { getCourse, getLecture, publicLecture, accessWhere } = require('./access');
const { checkVideo } = require('./upload');
const { cancelConversion, queueConversion, hlsPath, removeHls, storedFile } = require('./video');

async function list(courseId, query, user) {
    const course = await getCourse(courseId, user);
    const search = typeof query.q === 'string' ? query.q.slice(0, 160) : '';
    const options = {
        where: { course_id: course.id, title: { [Op.like]: `%${search}%` } },
        order: [
            ['position', 'ASC'],
            ['id', 'ASC'],
        ],
    };
    if (!user.canManage) {
        options.where.is_published = true;
        options.include = {
            model: LectureAccess,
            as: 'access',
            where: accessWhere(user.id),
            attributes: [],
            required: true,
        };
    }
    return { course: course.title, lectures: (await Lecture.findAll(options)).map(publicLecture) };
}

async function create(courseId, body, file, user) {
    let saved = false;
    try {
        const course = await getCourse(courseId, user);
        const lecture = await Lecture.create({
            course_id: course.id,
            title: text(body.title, '강의 제목'),
            description: body.description ? text(body.description, '강의 설명', 10000) : '',
            position: body.position === undefined ? 1 : id(body.position),
            is_published: body.isPublished === undefined ? true : bool(body.isPublished),
            video_file: file?.filename || null,
            mime_type: await checkVideo(file),
        });
        saved = true;
        if (file) await queueConversion(lecture.id, file.filename);
        return {
            message: file
                ? '강의·영상 등록 완료'
                : '강의 등록 완료. 영상은 아직 등록되지 않았습니다.',
            lecture: publicLecture(await getLecture(course.id, lecture.id, user)),
        };
    } catch (error) {
        if (!saved) await removeVideo(file?.filename);
        throw error;
    }
}

async function edit(courseId, lectureId, body, file, user) {
    let saved = false;
    try {
        const lecture = await getLecture(courseId, lectureId, user);
        const previousFile = lecture.video_file,
            previousHls = lecture.hls_key;
        const values = {};
        if (body.title !== undefined) values.title = text(body.title, '강의 제목');
        if (body.description !== undefined)
            values.description =
                body.description === '' ? '' : text(body.description, '강의 설명', 10000);
        if (body.position !== undefined) values.position = id(body.position);
        if (body.isPublished !== undefined) values.is_published = bool(body.isPublished);
        if (file) {
            Object.assign(values, {
                video_file: file.filename,
                mime_type: await checkVideo(file),
                hls_key: null,
                video_status: 'PROCESSING',
            });
        }
        await lecture.update(values);
        saved = true;
        if (file) {
            // 새 파일 검증·DB 저장 후에만 기존 변환을 취소하고 새 변환을 시작한다.
            await queueConversion(lecture.id, file.filename);
            await removeHls(previousHls);
            await removeVideo(previousFile);
        }
        return {
            message: '강의 수정 완료',
            lecture: publicLecture(await getLecture(courseId, lecture.id, user)),
        };
    } catch (error) {
        if (!saved) await removeVideo(file?.filename);
        throw error;
    }
}

async function remove(courseId, lectureId, user) {
    const lecture = await getLecture(courseId, lectureId, user);
    await cancelConversion(lecture.id);
    await lecture.destroy();
    await removeVideo(lecture.video_file);
    await removeHls(lecture.hls_key);
    return { message: '강의 삭제 완료' };
}

async function playback(courseId, lectureId, user) {
    const lecture = await getLecture(courseId, lectureId, user);
    if (!lecture.video_file) fail(409, '등록된 영상이 없습니다.');
    const hls =
        lecture.hls_key &&
        lecture.video_status === 'READY' &&
        (await storedFile(hlsPath(lecture.hls_key, 'index.m3u8')));
    if (!hls && !(await storedFile(videoPath(lecture.video_file))))
        fail(404, '이 서버의 영상 저장소에 파일이 없습니다.');
    return {
        lecture: publicLecture(lecture),
        format: hls ? 'hls' : 'original',
        playbackUrl:
            `/api/courses/${lecture.course_id}/lectures/${lecture.id}` +
            (hls ? `/hls/${lecture.hls_key}/index.m3u8` : ''),
    };
}

async function convert(courseId, lectureId, user) {
    const lecture = await getLecture(courseId, lectureId, user);
    if (!lecture.video_file) fail(409, '등록된 영상이 없습니다.');
    if (!(await storedFile(videoPath(lecture.video_file))))
        fail(404, '이 서버의 영상 저장소에 원본이 없습니다.');
    if (lecture.video_status === 'PROCESSING') fail(409, '변환 중입니다.');
    await queueConversion(lecture.id, lecture.video_file);
    return { message: '영상 변환을 시작했습니다.' };
}

async function hlsFile(courseId, lectureId, key, asset, user) {
    const lecture = await getLecture(courseId, lectureId, user);
    if (lecture.hls_key !== key || lecture.video_status !== 'READY')
        fail(404, '재생 가능한 영상이 아닙니다.');
    const filename = hlsPath(key, asset);
    if (!(await storedFile(filename))) fail(404, '이 서버의 영상 저장소에 파일이 없습니다.');
    return {
        filename,
        contentType: asset.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
        redirect: `/_protected_media/${key}/${asset}`,
    };
}

async function original(courseId, lectureId, info, range, user) {
    const lecture = await getLecture(courseId, lectureId, user);
    if (info === '1') return { json: { lecture: publicLecture(lecture) } };
    if (!lecture.video_file) fail(409, '등록된 영상이 없습니다.');
    const filename = videoPath(lecture.video_file);
    const file = await storedFile(filename);
    if (!file) fail(404, '이 서버의 영상 저장소에 원본이 없습니다.');
    const size = file.size;
    let start = 0,
        end = size - 1;
    if (range) {
        const invalid = { status: 416, headers: { 'Content-Range': `bytes */${size}` } };
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2])) return invalid;
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
        )
            return invalid;
    }
    return {
        filename,
        start,
        end,
        status: range ? 206 : 200,
        headers: {
            'Content-Type': lecture.mime_type,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Cache-Control': 'private, no-store',
            ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
        },
    };
}

function openStream(result) {
    return fs.createReadStream(result.filename, { start: result.start, end: result.end });
}

module.exports = { list, create, edit, remove, playback, convert, hlsFile, original, openStream };
