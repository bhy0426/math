const { describe, it, before, beforeEach, after } = require('mocha');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DataTypes, UniqueConstraintError } = require('sequelize');
require('./database-env');
// 서로 다른 서버의 동시 이관처럼 두 DB 연결이 겹치는 상황을 검사한다.
process.env.DB_CONNECTION_LIMIT = '2';

const originalDirectory = process.cwd();
const testDirectory = path.join(os.tmpdir(), `mathsite-social-migration-${crypto.randomUUID()}`);
process.env.UPLOAD_DIR = path.join(testDirectory, 'uploads');
process.env.TEST_PASSWORD = crypto.randomBytes(24).toString('hex');
const { sequelize, SocialAccount, User } = require('../src/models');
const { resetData } = require('./reset-data');
const { migrateSocialAccounts } = require('../database/migrate-social-accounts');
const { createSocialRepository } = require('../src/modules/auth/social.repository');
const mapping = sequelize.getQueryInterface();
const legacyTables = [
    'kakao_accounts',
    'google_accounts',
    '_migration_kakao_accounts',
    '_migration_google_accounts',
];
const scopeA = 'a'.repeat(64);
const scopeB = 'b'.repeat(64);
let adminId, studentId, viewerId;

async function clearLegacyTables() {
    const tables = await mapping.showAllTables();
    for (const name of legacyTables) {
        if (tables.includes(name)) await mapping.dropTable(name);
    }
}

async function createLegacy(provider, rows) {
    const isKakao = provider === 'kakao';
    const scope = isKakao ? 'app_key_hash' : 'client_id_hash';
    const identity = isKakao ? 'kakao_id' : 'google_id';
    const model = sequelize.define(
        `${provider}_accounts`,
        {
            [scope]: { type: DataTypes.CHAR(64), primaryKey: true },
            [identity]: { type: DataTypes.STRING(isKakao ? 32 : 255), primaryKey: true },
            user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: !isKakao },
            created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        },
        {
            timestamps: false,
            freezeTableName: true,
            indexes: isKakao
                ? [{ unique: true, fields: [scope, 'user_id'], name: 'one_kakao_per_user' }]
                : [],
        },
    );
    model.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
    sequelize.modelManager.removeModel(model);
    await model.sync();
    await model.bulkCreate(rows);
}

async function accounts() {
    return SocialAccount.findAll({
        raw: true,
        order: [
            ['provider', 'ASC'],
            ['app_key_hash', 'ASC'],
            ['provider_user_id', 'ASC'],
        ],
    });
}

describe('소셜 계정 테이블 이관과 기존 연결 규칙', () => {
    before(async () => {
        assert.equal(sequelize.config.database, 'mathsite_test');
        assert.ok(['localhost', '127.0.0.1'].includes(sequelize.config.host));
        await fs.mkdir(testDirectory);
        process.chdir(testDirectory);
    });

    beforeEach(async () => {
        await clearLegacyTables();
        await resetData();
        adminId = (await User.findOne({ where: { username: 'admin' } })).id;
        studentId = (await User.findOne({ where: { username: 'student' } })).id;
        viewerId = (await User.findOne({ where: { username: 'viewer' } })).id;
    });

    after(async () => {
        try {
            await clearLegacyTables();
        } finally {
            await sequelize.close();
            process.chdir(originalDirectory);
            assert.equal(path.dirname(path.resolve(testDirectory)), path.resolve(os.tmpdir()));
            assert.ok(path.basename(testDirectory).startsWith('mathsite-social-migration-'));
            await fs.rm(testDirectory, { recursive: true, force: true });
        }
    });

    it('구형 테이블이 없는 DB에서는 회원과 소셜 연결을 변경하지 않는다', async () => {
        const usersBefore = await User.findAll({ raw: true, order: [['id', 'ASC']] });
        assert.deepEqual(await migrateSocialAccounts(), { migrated: 0, backup: null });
        assert.deepEqual(await accounts(), []);
        assert.deepEqual(await User.findAll({ raw: true, order: [['id', 'ASC']] }), usersBefore);
        assert.equal(sequelize.models.kakao_accounts, undefined);
        assert.equal(sequelize.models.google_accounts, undefined);
    });

    it('양쪽 원본의 긴 식별자·회원·앱 범위·시각과 NULL을 정확히 백업하고 이관한다', async () => {
        const createdAt = new Date('2026-10-01T12:34:56.000Z');
        const largeIdentity = '90071992547409931234';
        await createLegacy('kakao', [
            {
                app_key_hash: scopeA,
                kakao_id: largeIdentity,
                user_id: studentId,
                created_at: createdAt,
            },
            { app_key_hash: scopeB, kakao_id: largeIdentity, user_id: studentId, created_at: null },
        ]);
        await createLegacy('google', [
            {
                client_id_hash: scopeA,
                google_id: largeIdentity,
                user_id: viewerId,
                created_at: null,
            },
        ]);
        const usersBefore = await User.findAll({ raw: true, order: [['id', 'ASC']] });
        const result = await migrateSocialAccounts();
        assert.equal(result.migrated, 3);
        const backup = JSON.parse(await fs.readFile(result.backup, 'utf8'));
        assert.equal(backup.database, 'mathsite_test');
        assert.deepEqual(
            backup.tables.map(({ table, rows }) => [table, rows.length]),
            [
                ['kakao_accounts', 2],
                ['google_accounts', 1],
            ],
        );
        const backedUpKakao = backup.tables[0].rows.find((row) => row.app_key_hash === scopeA);
        assert.equal(backedUpKakao.kakao_id, largeIdentity);
        assert.equal(backedUpKakao.created_at, createdAt.toISOString());
        assert.equal(backup.tables[1].rows[0].created_at, null);
        assert.deepEqual(await accounts(), [
            {
                provider: 'kakao',
                app_key_hash: scopeA,
                provider_user_id: largeIdentity,
                user_id: studentId,
                user_scope: scopeA,
                created_at: createdAt,
            },
            {
                provider: 'kakao',
                app_key_hash: scopeB,
                provider_user_id: largeIdentity,
                user_id: studentId,
                user_scope: scopeB,
                created_at: null,
            },
            {
                provider: 'google',
                app_key_hash: scopeA,
                provider_user_id: largeIdentity,
                user_id: viewerId,
                user_scope: '',
                created_at: null,
            },
        ]);
        const tables = await mapping.showAllTables();
        assert.ok(legacyTables.every((name) => !tables.includes(name)));
        assert.deepEqual(await User.findAll({ raw: true, order: [['id', 'ASC']] }), usersBefore);
        assert.equal(
            (await createSocialRepository('kakao').findAccount(scopeA, largeIdentity)).id,
            studentId,
        );
        assert.equal(
            (await createSocialRepository('google').findAccount(scopeA, largeIdentity)).id,
            viewerId,
        );
        const migrated = await accounts();
        assert.deepEqual(await migrateSocialAccounts(), { migrated: 0, backup: null });
        assert.deepEqual(await accounts(), migrated);
    });

    it('다른 회원 연결과 충돌하면 전체 복사를 취소하고 원본 staging을 보존한다', async () => {
        await createLegacy('kakao', [
            { app_key_hash: scopeA, kakao_id: 'kakao-new', user_id: studentId, created_at: null },
        ]);
        await createLegacy('google', [
            {
                client_id_hash: scopeA,
                google_id: 'google-conflict',
                user_id: viewerId,
                created_at: null,
            },
        ]);
        await SocialAccount.create({
            provider: 'google',
            app_key_hash: scopeA,
            provider_user_id: 'google-conflict',
            user_id: adminId,
            created_at: null,
        });
        const beforeCopy = await accounts();
        await assert.rejects(migrateSocialAccounts(), /기존 연결 정보가 일치하지 않습니다/);
        assert.deepEqual(await accounts(), beforeCopy);
        const tables = await mapping.showAllTables();
        assert.ok(tables.includes('_migration_kakao_accounts'));
        assert.ok(tables.includes('_migration_google_accounts'));
        await SocialAccount.destroy({ where: { provider: 'google', user_id: adminId } });
        assert.equal((await migrateSocialAccounts()).migrated, 2);
        assert.equal(await SocialAccount.count(), 2);
    });

    it('복사 커밋 후 원본 정리가 중단되어도 재실행으로 중복 없이 완료한다', async () => {
        await createLegacy('kakao', [
            { app_key_hash: scopeA, kakao_id: 'interrupted', user_id: studentId, created_at: null },
        ]);
        const originalDrop = mapping.dropTable;
        mapping.dropTable = async function (name, ...options) {
            if (name === '_migration_kakao_accounts')
                throw new Error('synthetic drop interruption');
            return originalDrop.call(this, name, ...options);
        };
        try {
            await assert.rejects(migrateSocialAccounts(), /synthetic drop interruption/);
        } finally {
            mapping.dropTable = originalDrop;
        }
        assert.equal(await SocialAccount.count(), 1);
        assert.ok((await mapping.showAllTables()).includes('_migration_kakao_accounts'));
        const copied = await accounts();
        assert.equal((await migrateSocialAccounts()).migrated, 1);
        assert.deepEqual(await accounts(), copied);
        assert.ok(!(await mapping.showAllTables()).includes('_migration_kakao_accounts'));
    });

    it('staging과 구버전 원본이 동시에 있으면 어느 쪽도 덮어쓰지 않는다', async () => {
        await createLegacy('kakao', [
            { app_key_hash: scopeA, kakao_id: 'first', user_id: studentId, created_at: null },
        ]);
        await mapping.renameTable('kakao_accounts', '_migration_kakao_accounts');
        await createLegacy('kakao', [
            { app_key_hash: scopeB, kakao_id: 'recreated', user_id: viewerId, created_at: null },
        ]);
        await assert.rejects(migrateSocialAccounts(), /구형 테이블이 다시 발견되었습니다/);
        const tables = await mapping.showAllTables();
        assert.ok(tables.includes('kakao_accounts'));
        assert.ok(tables.includes('_migration_kakao_accounts'));
        assert.equal(await SocialAccount.count(), 0);
    });

    it('공급자·앱 식별자를 구분하고 기존 카카오·구글 회원 연결 고유 제약을 지킨다', async () => {
        const kakao = createSocialRepository('kakao');
        const google = createSocialRepository('google');
        await kakao.createLink(scopeA, 'shared-identity', studentId);
        await kakao.createLink(scopeB, 'shared-identity', studentId);
        await google.createLink(scopeA, 'shared-identity', studentId);
        await assert.rejects(
            kakao.createLink(scopeA, 'another-kakao', studentId),
            UniqueConstraintError,
        );
        await assert.rejects(
            google.createLink(scopeB, 'another-google', studentId),
            UniqueConstraintError,
        );
        await assert.rejects(
            kakao.createLink(scopeA, 'shared-identity', viewerId),
            UniqueConstraintError,
        );
        assert.equal(await SocialAccount.count(), 3);
        assert.equal(await kakao.hasConnection(scopeB, studentId), true);
        assert.equal(await google.hasConnection(scopeB, studentId), false);
        await sequelize.transaction(async (transaction) => {
            assert.equal(
                await google.hasAnyConnection(scopeA, [adminId, studentId], { transaction }),
                true,
            );
        });
    });

    it('회원 삭제 시 소셜 연결도 정리하고 다른 회원 연결은 보존한다', async () => {
        await createSocialRepository('kakao').createLink(scopeA, 'remove-with-user', viewerId);
        await createSocialRepository('google').createLink(scopeA, 'preserved-user', studentId);
        await User.destroy({ where: { id: viewerId } });
        assert.equal(await SocialAccount.count({ where: { user_id: viewerId } }), 0);
        assert.equal(await SocialAccount.count({ where: { user_id: studentId } }), 1);
    });

    it('동시에 시작된 이관이 같은 원본을 처리해도 연결을 한 번만 저장한다', async () => {
        await createLegacy('kakao', [
            { app_key_hash: scopeA, kakao_id: 'parallel', user_id: studentId, created_at: null },
        ]);
        await createLegacy('google', [
            { client_id_hash: scopeA, google_id: 'parallel', user_id: viewerId, created_at: null },
        ]);
        await Promise.all([migrateSocialAccounts(), migrateSocialAccounts()]);
        assert.equal(await SocialAccount.count(), 2);
        const tables = await mapping.showAllTables();
        assert.ok(legacyTables.every((name) => !tables.includes(name)));
    });
});
