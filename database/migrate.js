const { DataTypes, Op, fn, col, where } = require('sequelize');
const { sequelize, User, Lecture } = require('../src/models');
const { migrateSocialAccounts } = require('./migrate-social-accounts');

async function migrate() {
    const mapping = sequelize.getQueryInterface();
    const tables = await mapping.showAllTables();
    const columns = [
        ['users', 'username', { type: DataTypes.STRING(40), unique: true }],
        [
            'lectures',
            'video_status',
            { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'NO_VIDEO' },
        ],
        ['lectures', 'hls_key', { type: DataTypes.CHAR(36) }],
        [
            'boards',
            'popup_enabled',
            { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        ],
    ];
    for (const [table, name, definition] of columns) {
        if (!tables.includes(table)) continue;
        const description = await mapping.describeTable(table);
        if (!description[name]) await mapping.addColumn(table, name, definition);
    }
    if (tables.includes('signup_codes')) {
        const { sent_at: sentAt } = await mapping.describeTable('signup_codes');
        // 첫 발송은 코드를 예약한 뒤 같은 트랜잭션에서 발송 시각을 기록한다.
        if (sentAt && !sentAt.allowNull)
            await mapping.changeColumn('signup_codes', 'sent_at', {
                type: DataTypes.DATE(3),
                allowNull: true,
            });
    }
    let duplicateNicknames = 0;
    if (tables.includes('users')) {
        const description = await mapping.describeTable('users');
        for (const [column, type] of [
            ['name', DataTypes.STRING(80)],
            ['email', DataTypes.STRING(254)],
        ])
            if (description[column] && !description[column].allowNull)
                await mapping.changeColumn('users', column, { type, allowNull: true });
        const duplicates = await User.findAll({
            attributes: ['nickname'],
            where: { nickname: { [Op.ne]: null } },
            group: ['nickname'],
            having: where(fn('COUNT', col('id')), { [Op.gt]: 1 }),
        });
        duplicateNicknames = duplicates.length;
    }
    // 기존 회원 테이블의 닉네임 제약과 나머지 테이블 준비를 독립적으로 처리한다.
    // 모델은 참조 대상(역할·회원·강좌)이 먼저 정의되어 있다.
    for (const model of Object.values(sequelize.models)) {
        if (model === User && tables.includes('users')) continue;
        await model.sync();
    }
    const socialAccounts = await migrateSocialAccounts();
    if (tables.includes('users') && !duplicateNicknames) {
        const indexes = await mapping.showIndex('users');
        if (!indexes.some((index) => index.name === 'users_nickname_unique'))
            await mapping.addIndex('users', ['name'], {
                name: 'users_nickname_unique',
                unique: true,
            });
    }
    await Lecture.update(
        { video_status: 'ORIGINAL' },
        { where: { video_file: { [Op.ne]: null }, video_status: 'NO_VIDEO' } },
    );
    return { duplicateNicknames, socialAccounts };
}

module.exports = { migrate };
