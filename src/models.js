const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const primaryId = () => ({
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
});
const required = (type) => ({ type, allowNull: false });
const createdAt = () => ({ type: DataTypes.DATE, defaultValue: DataTypes.NOW });
const define = (name, attributes, options = {}) =>
    sequelize.define(name, attributes, { timestamps: false, freezeTableName: true, ...options });

const Role = define('roles', {
    id: primaryId(),
    code: { ...required(DataTypes.STRING(40)), unique: true },
    name: required(DataTypes.STRING(80)),
    can_manage: { ...required(DataTypes.BOOLEAN), defaultValue: false },
});
const User = define(
    'users',
    {
        id: primaryId(),
        // 기존 회원을 보존한다. API·모델은 nickname, 기존 DB 열은 name이다.
        nickname: { type: DataTypes.STRING(80), field: 'name' },
        email: { type: DataTypes.STRING(254), unique: true },
        username: { type: DataTypes.STRING(40), unique: true },
        password_hash: required(DataTypes.STRING(200)),
        role_id: required(DataTypes.INTEGER.UNSIGNED),
        status: {
            ...required(DataTypes.ENUM('pending', 'active', 'suspended')),
            defaultValue: 'pending',
        },
        session_version: { ...required(DataTypes.INTEGER.UNSIGNED), defaultValue: 0 },
        created_at: createdAt(),
    },
    { indexes: [{ name: 'users_nickname_unique', unique: true, fields: ['name'] }] },
);
const SocialAccount = define(
    'social_accounts',
    {
        provider: { type: DataTypes.ENUM('kakao', 'google'), primaryKey: true },
        app_key_hash: { type: DataTypes.CHAR(64), primaryKey: true },
        provider_user_id: { type: DataTypes.STRING(255), primaryKey: true },
        user_id: required(DataTypes.INTEGER.UNSIGNED),
        // 카카오는 앱별로, 구글은 모든 앱을 통틀어 회원당 한 계정만 연결한다.
        user_scope: required(DataTypes.STRING(64)),
        created_at: createdAt(),
    },
    {
        indexes: [
            {
                name: 'one_social_account_per_user_scope',
                unique: true,
                fields: ['provider', 'user_scope', 'user_id'],
            },
        ],
        hooks: {
            beforeValidate(account) {
                account.user_scope = account.provider === 'google' ? '' : account.app_key_hash;
            },
        },
    },
);
const MemberField = define('member_fields', {
    key: { type: DataTypes.STRING(20), primaryKey: true },
    enabled: { ...required(DataTypes.BOOLEAN), defaultValue: true },
});
const Group = define('student_groups', {
    id: primaryId(),
    name: { ...required(DataTypes.STRING(80)), unique: true },
});
const GroupMember = define('group_members', {
    group_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
});
const Broadcast = define('mail_broadcasts', {
    request_id: { type: DataTypes.CHAR(36), primaryKey: true },
    admin_id: required(DataTypes.INTEGER.UNSIGNED),
    input_hash: required(DataTypes.CHAR(64)),
});
const BroadcastDelivery = define('mail_broadcast_deliveries', {
    request_id: { type: DataTypes.CHAR(36), primaryKey: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
    status: { ...required(DataTypes.STRING(12)), defaultValue: 'pending' },
    updated_at: createdAt(),
});
const Course = define('courses', {
    id: primaryId(),
    title: required(DataTypes.STRING(160)),
    description: required(DataTypes.TEXT),
    teacher: { ...required(DataTypes.STRING(80)), defaultValue: '' },
    is_published: { ...required(DataTypes.BOOLEAN), defaultValue: true },
    created_at: createdAt(),
});
const Lecture = define('lectures', {
    id: primaryId(),
    course_id: required(DataTypes.INTEGER.UNSIGNED),
    title: required(DataTypes.STRING(160)),
    description: required(DataTypes.TEXT),
    position: { ...required(DataTypes.INTEGER.UNSIGNED), defaultValue: 1 },
    is_published: { ...required(DataTypes.BOOLEAN), defaultValue: true },
    video_file: DataTypes.STRING(80),
    mime_type: DataTypes.STRING(80),
    video_status: { ...required(DataTypes.STRING(20)), defaultValue: 'NO_VIDEO' },
    hls_key: DataTypes.CHAR(36),
    created_at: createdAt(),
});
const LectureAccess = define('lecture_access', {
    user_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
    lecture_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
    starts_at: required(DataTypes.DATE),
    expires_at: required(DataTypes.DATE),
    granted_by: DataTypes.INTEGER.UNSIGNED,
});
const Board = define('boards', {
    id: primaryId(),
    title: required(DataTypes.STRING(160)),
    content: required(DataTypes.TEXT),
    author_id: DataTypes.INTEGER.UNSIGNED,
    is_pinned: { ...required(DataTypes.BOOLEAN), defaultValue: false },
    popup_enabled: { ...required(DataTypes.BOOLEAN), defaultValue: false },
    created_at: createdAt(),
});
const Question = define('questions', {
    id: primaryId(),
    user_id: DataTypes.INTEGER.UNSIGNED,
    title: required(DataTypes.STRING(160)),
    content: required(DataTypes.TEXT),
    is_private: { ...required(DataTypes.BOOLEAN), defaultValue: true },
    answer: DataTypes.TEXT,
    answered_by: DataTypes.INTEGER.UNSIGNED,
    created_at: createdAt(),
});
const PasswordReset = define('password_resets', {
    token_hash: { type: DataTypes.CHAR(64), primaryKey: true },
    user_id: required(DataTypes.INTEGER.UNSIGNED),
    expires_at: required(DataTypes.DATE),
    used_at: DataTypes.DATE,
});
const SignupCode = define(
    'signup_codes',
    {
        email: { type: DataTypes.STRING(254), primaryKey: true },
        session_hash: required(DataTypes.CHAR(64)),
        code_hash: required(DataTypes.CHAR(64)),
        attempts: { ...required(DataTypes.INTEGER.UNSIGNED), defaultValue: 0 },
        sent_at: { type: DataTypes.DATE(3), allowNull: true },
        expires_at: required(DataTypes.DATE(3)),
    },
    { indexes: [{ fields: ['expires_at'] }] },
);

User.belongsTo(Role, { as: 'roleRecord', foreignKey: 'role_id', onDelete: 'RESTRICT' });
Role.hasMany(User, { as: 'users', foreignKey: 'role_id', onDelete: 'RESTRICT' });
SocialAccount.belongsTo(User, { as: 'user', foreignKey: 'user_id', onDelete: 'CASCADE' });
Group.hasMany(GroupMember, { as: 'memberships', foreignKey: 'group_id', onDelete: 'CASCADE' });
GroupMember.belongsTo(Group, { as: 'group', foreignKey: 'group_id', onDelete: 'CASCADE' });
GroupMember.belongsTo(User, { as: 'student', foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(GroupMember, { as: 'memberships', foreignKey: 'user_id', onDelete: 'CASCADE' });
BroadcastDelivery.belongsTo(Broadcast, {
    as: 'broadcast',
    foreignKey: 'request_id',
    onDelete: 'CASCADE',
});
Lecture.belongsTo(Course, { as: 'course', foreignKey: 'course_id', onDelete: 'CASCADE' });
Course.hasMany(Lecture, { as: 'lectures', foreignKey: 'course_id', onDelete: 'CASCADE' });
LectureAccess.belongsTo(User, { as: 'user', foreignKey: 'user_id', onDelete: 'CASCADE' });
LectureAccess.belongsTo(User, { as: 'grantor', foreignKey: 'granted_by', onDelete: 'SET NULL' });
LectureAccess.belongsTo(Lecture, { as: 'lecture', foreignKey: 'lecture_id', onDelete: 'CASCADE' });
Lecture.hasMany(LectureAccess, { as: 'access', foreignKey: 'lecture_id', onDelete: 'CASCADE' });
Board.belongsTo(User, { as: 'author', foreignKey: 'author_id', onDelete: 'SET NULL' });
Question.belongsTo(User, { as: 'author', foreignKey: 'user_id', onDelete: 'SET NULL' });
Question.belongsTo(User, { as: 'answerer', foreignKey: 'answered_by', onDelete: 'SET NULL' });
PasswordReset.belongsTo(User, { as: 'user', foreignKey: 'user_id', onDelete: 'CASCADE' });

module.exports = {
    sequelize,
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
