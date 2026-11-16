const { Op } = require('sequelize');
const {
    sequelize,
    Group,
    GroupMember,
    User,
    Role,
    Lecture,
    LectureAccess,
} = require('../../models');
const { id, text, fail } = require('../../shared/helpers');
const { accessPeriod } = require('../courses/access');
const { saveLectureGrants } = require('./lecture-access.service');

function ids(values) {
    if (!Array.isArray(values)) fail(400, '선택 목록을 배열로 보내세요.');
    const unique = new Set();
    for (const value of values) {
        if (!['string', 'number'].includes(typeof value)) fail(400, '잘못된 선택입니다.');
        unique.add(id(value));
    }
    return [...unique].sort((a, b) => a - b);
}

async function getGroup(value, transaction) {
    const group = await Group.findByPk(id(value), {
        transaction,
        lock: transaction?.LOCK.UPDATE,
    });
    if (!group) fail(404, '회원 그룹이 없습니다.');
    return group;
}

async function list() {
    const groups = await Group.findAll({
        include: { model: GroupMember, as: 'memberships', attributes: ['user_id'] },
        order: [
            ['name', 'ASC'],
            [{ model: GroupMember, as: 'memberships' }, 'user_id', 'ASC'],
        ],
    });
    return {
        groups: groups.map((group) => ({
            id: group.id,
            name: group.name,
            memberIds: group.memberships.map((row) => row.user_id),
        })),
    };
}

async function create(body) {
    const group = await Group.create({ name: text(body.name, '그룹 이름', 80) });
    return {
        message: '회원 그룹을 만들었습니다.',
        group: { id: group.id, name: group.name, memberIds: [] },
    };
}

async function rename(groupId, body) {
    const name = text(body.name, '그룹 이름', 80);
    await sequelize.transaction(async (transaction) => {
        const group = await getGroup(groupId, transaction);
        await group.update({ name }, { transaction });
    });
    return { message: '그룹 이름을 변경했습니다.' };
}

async function remove(groupId) {
    if (!(await Group.destroy({ where: { id: id(groupId) } }))) fail(404, '회원 그룹이 없습니다.');
    return { message: '그룹을 삭제했습니다. 기존 회원과 시청 권한은 유지됩니다.' };
}

// 선택한 ID를 서버에서 다시 확인한다. null은 목록 조회 시에만 전체 학생을 뜻한다.
async function selectedStudents(groupId, userIds, { transaction, attributes = ['id'] } = {}) {
    const selected = userIds === null ? null : ids(userIds);
    if (selected?.length === 0) fail(400, '학생을 한 명 이상 선택하세요.');
    const include = [
        { model: Role, as: 'roleRecord', where: { can_manage: false }, attributes: [] },
    ];
    if (groupId != null) {
        const group = await getGroup(groupId, transaction);
        include.push({
            model: GroupMember,
            as: 'memberships',
            where: { group_id: group.id },
            attributes: [],
        });
    }
    const students = await User.findAll({
        attributes,
        where: { status: 'active', ...(selected && { id: { [Op.in]: selected } }) },
        include,
        order: [['id', 'ASC']],
        transaction,
        lock: transaction?.LOCK.UPDATE,
    });
    if (selected && students.length !== selected.length)
        fail(409, '소속 또는 승인 상태가 바뀐 학생이 있습니다. 목록을 새로 확인하세요.');
    return students;
}

async function editMembers(groupId, body) {
    const add = ids(body.addUserIds ?? []);
    const remove = ids(body.removeUserIds ?? []);
    const removed = new Set(remove);
    if (!add.length && !remove.length) fail(400, '변경할 학생을 선택하세요.');
    if (add.some((userId) => removed.has(userId)))
        fail(400, '같은 학생을 추가하고 제외할 수 없습니다.');
    await sequelize.transaction(async (transaction) => {
        const group = await getGroup(groupId, transaction);
        if (add.length) {
            await selectedStudents(null, add, { transaction });
            await GroupMember.bulkCreate(
                add.map((userId) => ({ group_id: group.id, user_id: userId })),
                {
                    ignoreDuplicates: true,
                    transaction,
                },
            );
        }
        if (remove.length)
            await GroupMember.destroy({
                where: { group_id: group.id, user_id: { [Op.in]: remove } },
                transaction,
            });
    });
    return { message: '그룹 회원을 변경했습니다.' };
}

// 그룹은 일괄 작업 시 대상을 고르는 용도다. 저장된 권한은 기존 개인 권한과 같은 테이블을 사용한다.
async function editAccess(groupId, body, adminId) {
    const lectureIds = ids(body.lectureIds);
    const userIds = ids(body.userIds);
    if (!lectureIds.length || !userIds.length)
        fail(400, '학생과 강의를 한 명·한 개 이상 선택하세요.');
    if (!['grant', 'revoke'].includes(body.action)) fail(400, '권한 부여 또는 회수를 선택하세요.');
    const grant = body.action === 'grant';
    const period = grant && accessPeriod(body);
    await sequelize.transaction(async (transaction) => {
        await selectedStudents(groupId, userIds, { transaction });
        const lectures = await Lecture.findAll({
            attributes: ['id'],
            where: { id: { [Op.in]: lectureIds } },
            order: [['id', 'ASC']],
            transaction,
            lock: transaction.LOCK.SHARE,
        });
        if (lectures.length !== lectureIds.length)
            fail(404, '선택한 강의 중 존재하지 않는 강의가 있습니다.');
        if (grant) {
            for (const lectureId of lectureIds) {
                await saveLectureGrants(lectureId, userIds, period, adminId, transaction);
            }
        } else {
            await LectureAccess.destroy({
                where: { user_id: { [Op.in]: userIds }, lecture_id: { [Op.in]: lectureIds } },
                transaction,
            });
        }
    });
    return {
        message: grant
            ? '선택한 학생에게 시청 권한을 부여했습니다.'
            : '선택한 학생의 시청 권한을 회수했습니다.',
        studentCount: userIds.length,
        lectureCount: lectureIds.length,
    };
}

module.exports = { list, create, rename, remove, editMembers, editAccess, selectedStudents };
