const { sequelize, Role, User } = require('../src/models');
const { text, email, username } = require('../src/shared/helpers');
const { hashPassword } = require('../src/modules/auth/password');
const { migrate } = require('../database/migrate');

async function initialize() {
    const result = await migrate();
    if (result.duplicateNicknames)
        console.warn('테이블 준비 완료. 기존 중복 닉네임의 고유 제약만 적용을 보류했습니다.');
    await Role.findOrCreate({
        where: { code: 'admin' },
        defaults: { name: '관리자', can_manage: true },
    });
    await Role.findOrCreate({
        where: { code: 'student' },
        defaults: { name: '학생', can_manage: false },
    });
}

async function createInitialAdmin() {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || (await User.count())) return;
    const role = await Role.findOne({ where: { code: 'admin' } });
    await User.create({
        nickname: text(process.env.ADMIN_NICKNAME || '관리자', '닉네임', 80),
        email: email(process.env.ADMIN_EMAIL),
        username: process.env.ADMIN_USERNAME ? username(process.env.ADMIN_USERNAME) : null,
        password_hash: await hashPassword(process.env.ADMIN_PASSWORD),
        role_id: role.id,
        status: 'active',
    });
}

module.exports = { initialize };
if (require.main === module)
    initialize()
        .then(createInitialAdmin)
        .then(() => console.log('Sequelize 매핑 준비 완료: 기존 데이터 유지'))
        .catch((error) => {
            console.error(error.original?.code || error.message);
            process.exitCode = 1;
        })
        .finally(() => sequelize.close());
