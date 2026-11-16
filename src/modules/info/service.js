const { Op } = require('sequelize');
const { Question } = require('../../models');
const { text, id, bool, fail } = require('../../shared/helpers');

async function getQuestion(value, user) {
    const question = await Question.findByPk(id(value));
    if (!question) fail(404, '질문이 없습니다.');
    if (!user.canManage && question.is_private && question.user_id !== user.id)
        fail(403, '비공개 질문입니다.');
    return question;
}
async function list(user) {
    const where = user.canManage ? {} : { [Op.or]: [{ is_private: false }, { user_id: user.id }] };
    return { questions: await Question.findAll({ where, order: [['id', 'DESC']] }) };
}
async function create(body, user) {
    const question = await Question.create({
        user_id: user.id,
        title: text(body.title, '질문 제목'),
        content: text(body.content, '질문 내용', 10000),
        is_private: body.isPrivate === undefined ? true : bool(body.isPrivate),
        answer: null,
    });
    return { message: '질문 등록 완료', question };
}
async function detail(questionId, user) {
    return { question: await getQuestion(questionId, user) };
}
async function edit(questionId, body, user) {
    const question = await getQuestion(questionId, user);
    if (question.user_id !== user.id) fail(403, '작성자만 질문을 수정할 수 있습니다.');
    const changes = {};
    if (body.title !== undefined) changes.title = text(body.title, '질문 제목');
    if (body.content !== undefined) changes.content = text(body.content, '질문 내용', 10000);
    if (body.isPrivate !== undefined) changes.is_private = bool(body.isPrivate);
    await question.update(changes);
    return { message: '질문 수정 완료', question };
}
async function remove(questionId, user) {
    const question = await getQuestion(questionId, user);
    if (question.user_id !== user.id && !user.canManage)
        fail(403, '작성자 또는 관리자만 삭제할 수 있습니다.');
    await question.destroy();
    return { message: '질문 삭제 완료' };
}
async function answer(questionId, body, user, action) {
    const question = await getQuestion(questionId, user);
    if (action === 'create' && question.answer !== null)
        fail(409, '이미 답변이 있습니다. 수정 API를 사용하세요.');
    if (action !== 'create' && question.answer === null) fail(404, '등록된 답변이 없습니다.');
    await question.update({
        answer: action === 'remove' ? null : text(body.answer, '답변', 10000),
        answered_by: action === 'remove' ? null : user.id,
    });
    return {
        message:
            action === 'remove'
                ? '답변 삭제 완료'
                : action === 'create'
                  ? '답변 등록 완료'
                  : '답변 수정 완료',
        ...(action !== 'remove' ? { question } : {}),
    };
}

module.exports = { list, create, detail, edit, remove, answer };
