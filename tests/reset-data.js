const assert = require('node:assert/strict');
const {
    sequelize,
    KakaoAccount,
    GoogleAccount,
    MemberField,
    PasswordReset,
    SignupCode,
    LectureAccess,
    Question,
    Board,
    Lecture,
    Course,
    User,
    Role,
} = require('../src/models');
const { initialize } = require('./seed');

async function resetData() {
    assert.equal(sequelize.config.database, 'mathsite_test');
    assert.ok(['localhost', '127.0.0.1'].includes(sequelize.config.host));
    await initialize();
    for (const model of [
        KakaoAccount,
        GoogleAccount,
        MemberField,
        PasswordReset,
        SignupCode,
        LectureAccess,
        Question,
        Board,
        Lecture,
        Course,
        User,
        Role,
    ])
        await model.destroy({ where: {} });
    await initialize();
}

module.exports = { resetData };
