const { Op } = require('sequelize');
const { Board } = require('../../models');
const { text, id, bool, fail } = require('../../shared/helpers');

async function getBoard(value) {
    const board = await Board.findByPk(id(value));
    if (!board) fail(404, '공지가 없습니다.');
    return board;
}
async function list(query) {
    const search = typeof query.q === 'string' ? query.q.slice(0, 160) : '';
    return {
        boards: await Board.findAll({
            where: { title: { [Op.like]: `%${search}%` } },
            order: [
                ['is_pinned', 'DESC'],
                ['id', 'DESC'],
            ],
        }),
    };
}
async function popup() {
    return {
        board: await Board.findOne({ where: { popup_enabled: true }, order: [['id', 'DESC']] }),
    };
}
async function detail(boardId) {
    return { board: await getBoard(boardId) };
}
async function create(body, userId) {
    const board = await Board.create({
        title: text(body.title, '제목'),
        content: text(body.content, '내용', 10000),
        author_id: userId,
        is_pinned: body.isPinned === undefined ? false : bool(body.isPinned),
        popup_enabled: body.popupEnabled === undefined ? false : bool(body.popupEnabled),
    });
    return { message: '공지 등록 완료', board };
}
async function edit(boardId, body) {
    const board = await getBoard(boardId);
    const changes = {};
    if (body.title !== undefined) changes.title = text(body.title, '제목');
    if (body.content !== undefined) changes.content = text(body.content, '내용', 10000);
    if (body.isPinned !== undefined) changes.is_pinned = bool(body.isPinned);
    if (body.popupEnabled !== undefined) changes.popup_enabled = bool(body.popupEnabled);
    await board.update(changes);
    return { message: '공지 수정 완료', board };
}
async function remove(boardId) {
    const board = await getBoard(boardId);
    await board.destroy();
    return { message: '공지 삭제 완료' };
}
async function pin(boardId, body) {
    return {
        ...(await edit(boardId, { isPinned: bool(body.isPinned) })),
        message: '공지 고정 상태 변경 완료',
    };
}

module.exports = { list, popup, detail, create, edit, remove, pin };
