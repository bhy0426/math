const crypto = require('node:crypto');
const { Validator, UniqueConstraintError } = require('sequelize');
const { sequelize, Broadcast, BroadcastDelivery } = require('../../models');
const { fail, id, text } = require('../../shared/helpers');
const { sendStudentMail, requireMail } = require('../auth/mail');
const { selectedStudents } = require('./groups.service');
const { requireEmailFields, selectFields } = require('./member-fields.service');
const { readSender } = require('./mail-sender.store');

// SMTP의 연결·응답 제한(각 10초)보다 길다. 중단된 실행은 영수증에 표시하고 재발송하지 않는다.
const staleAfter = 2 * 60 * 1000;

function requestKey(value) {
    if (typeof value !== 'string' || !Validator.isUUID(value, 4))
        fail(400, '발송 요청 번호를 확인하세요.');
    return value.toLowerCase();
}

function messageInput(input) {
    const requestId = requestKey(input?.requestId);
    const groupId = input.groupId == null ? null : id(input.groupId);
    const subject = text(input.subject, '메일 제목', 160);
    if (/[\r\n\x00]/.test(subject)) fail(400, '메일 제목은 한 줄로 입력하세요.');
    const body = text(input.body, '메일 본문', 10000);
    if (!Array.isArray(input.userIds) || !input.userIds.length)
        fail(400, '메일을 받을 학생을 한 명 이상 선택하세요.');
    const userIds = [
        ...new Set(
            input.userIds.map((value) => {
                if (!['number', 'string'].includes(typeof value))
                    fail(400, '학생 번호를 확인하세요.');
                return id(value);
            }),
        ),
    ].sort((a, b) => a - b);
    const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify([groupId, userIds, subject, body]))
        .digest('hex');
    return { requestId, groupId, userIds, subject, body, hash };
}

async function audience(groupId, userIds, transaction) {
    const fields = await requireEmailFields({ transaction });
    const attributes = ['id', ...fields.filter((field) => field.enabled).map((field) => field.key)];
    const users = await selectedStudents(groupId, userIds, { attributes, transaction });
    const valid = users.filter(
        (user) => typeof user.email === 'string' && Validator.isEmail(user.email),
    );
    if (userIds && valid.length !== userIds.length)
        fail(409, '수신자 정보가 바뀌었습니다. 다시 선택하세요.');
    return valid.map((user) => ({ id: user.id, ...selectFields(user, fields) }));
}

async function recipients(groupId) {
    return { users: await audience(groupId, null) };
}

function summary(requestId, recipients) {
    const sending = recipients.some((row) => row.status === 'pending');
    return {
        requestId,
        status: sending ? 'sending' : 'complete',
        recipients,
        message: sending ? '개별 메일을 발송하고 있습니다.' : '학생별 발송 결과를 확인하세요.',
    };
}

async function receipt(adminId, value) {
    const requestId = requestKey(value);
    return sequelize.transaction(async (transaction) => {
        const owner = await Broadcast.findOne({
            where: { request_id: requestId, admin_id: adminId },
            transaction,
        });
        if (!owner) fail(404, '발송 기록이 없습니다.');
        const rows = await BroadcastDelivery.findAll({
            where: { request_id: requestId },
            order: [['user_id', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        const lastActivity = rows.reduce(
            (latest, row) => Math.max(latest, row.updated_at.getTime()),
            0,
        );
        const abandoned = Date.now() - lastActivity > staleAfter;
        if (abandoned && rows.some((row) => ['pending', 'sending'].includes(row.status))) {
            for (const [from, to] of [
                ['pending', 'failed'],
                ['sending', 'unknown'],
            ]) {
                await BroadcastDelivery.update(
                    { status: to, updated_at: new Date() },
                    {
                        where: { request_id: requestId, status: from },
                        transaction,
                    },
                );
                for (const row of rows) if (row.status === from) row.status = to;
            }
        }
        return summary(
            requestId,
            rows.map((row) => ({
                userId: row.user_id,
                status: row.status === 'sending' ? 'pending' : row.status,
            })),
        );
    });
}

async function dispatch(message, sender) {
    for (const userId of message.userIds) {
        const where = { request_id: message.requestId, user_id: userId };
        // SMTP 직전에 상태를 기록한다. 새로고침·재시작·재시도에도 이미 시도한 메일은 다시 보내지 않는다.
        const [claimed] = await BroadcastDelivery.update(
            { status: 'sending', updated_at: new Date() },
            {
                where: { ...where, status: 'pending' },
            },
        );
        if (!claimed) continue;
        let status;
        try {
            const [user] = await audience(message.groupId, [userId]);
            await sendStudentMail(user.email, message.subject, message.body, sender);
            status = 'sent';
        } catch (error) {
            status = error.deliveryUncertain ? 'unknown' : 'failed';
        }
        await BroadcastDelivery.update({ status, updated_at: new Date() }, { where });
    }
}

async function submit(adminId, input) {
    const message = messageInput(input);
    const { requestId, groupId, userIds, hash } = message;
    let previous = await Broadcast.findByPk(requestId);
    if (!previous) {
        const sender = readSender();
        if (!sender) fail(503, '학원 관리에서 발신 계정을 먼저 등록하세요.');
        requireMail('학생 안내');
        try {
            await sequelize.transaction(async (transaction) => {
                await audience(groupId, userIds, transaction);
                await Broadcast.create(
                    { request_id: requestId, admin_id: adminId, input_hash: hash },
                    { transaction },
                );
                await BroadcastDelivery.bulkCreate(
                    userIds.map((userId) => ({ request_id: requestId, user_id: userId })),
                    { transaction },
                );
            });
        } catch (error) {
            if (!(error instanceof UniqueConstraintError)) throw error;
            previous = await Broadcast.findByPk(requestId);
            if (!previous) throw error;
        }
        if (!previous) {
            // 요청을 먼저 접수한다. 실제 전송 중 DB 연결이나 HTTP 응답을 붙잡아 두지 않는다.
            dispatch(message, sender).catch(() =>
                console.error('학생 메일 발송이 중단되었습니다. 발송 결과를 확인하세요.'),
            );
            return summary(
                requestId,
                userIds.map((userId) => ({ userId, status: 'pending' })),
            );
        }
    }
    if (previous.admin_id !== adminId) fail(404, '발송 기록이 없습니다.');
    if (previous.input_hash !== hash) fail(409, '이미 다른 내용으로 접수한 요청 번호입니다.');
    return receipt(adminId, requestId);
}

module.exports = { recipients, submit, receipt };
