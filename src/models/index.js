const { sequelize } = require('../database');
const Role = require('./role');
const User = require('./user');
const SocialAccount = require('./social-account');
const MemberField = require('./member-field');
const Group = require('./group');
const GroupMember = require('./group-member');
const Broadcast = require('./broadcast');
const BroadcastDelivery = require('./broadcast-delivery');
const Course = require('./course');
const Lecture = require('./lecture');
const LectureAccess = require('./lecture-access');
const Board = require('./board');
const Question = require('./question');
const PasswordReset = require('./password-reset');
const SignupCode = require('./signup-code');

// 참조되는 모델부터 등록한다. 기존 DB 준비 코드도 이 순서로 모델을 읽는다.
const models = {
    Role,
    User,
    SocialAccount,
    MemberField,
    Group,
    GroupMember,
    Broadcast,
    BroadcastDelivery,
    Course,
    Lecture,
    LectureAccess,
    Board,
    Question,
    PasswordReset,
    SignupCode,
};

for (const model of Object.values(models)) model.init(sequelize);
// 모든 모델의 등록이 끝난 뒤 외래키와 조회 관계를 연결한다.
for (const model of Object.values(models)) {
    if (typeof model.associate === 'function') model.associate(models);
}

module.exports = { sequelize, ...models };
