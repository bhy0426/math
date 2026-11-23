const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { DataTypes } = require('sequelize');
const { sequelize, SocialAccount, User } = require('../src/models');

const sources = [
    { provider: 'kakao', table: 'kakao_accounts', scope: 'app_key_hash', identity: 'kakao_id' },
    {
        provider: 'google',
        table: 'google_accounts',
        scope: 'client_id_hash',
        identity: 'google_id',
    },
];

function stagingTable(source) {
    return `_migration_${source.table}`;
}

function sourceModel(source) {
    const model = sequelize.define(
        stagingTable(source),
        {
            [source.scope]: { type: DataTypes.CHAR(64), primaryKey: true },
            [source.identity]: { type: DataTypes.STRING(255), primaryKey: true },
            user_id: DataTypes.INTEGER.UNSIGNED,
            created_at: DataTypes.DATE,
        },
        { timestamps: false, freezeTableName: true },
    );
    // 이관 전용 매핑은 다음 sync()에서 구형 테이블을 다시 생성하지 않도록 제외한다.
    sequelize.modelManager.removeModel(model);
    return model;
}

function migratedValues(source, row) {
    return {
        provider: source.provider,
        app_key_hash: row[source.scope],
        provider_user_id: row[source.identity],
        user_id: row.user_id,
        user_scope: source.provider === 'google' ? '' : row[source.scope],
        created_at: row.created_at,
    };
}

function matches(row, expected) {
    return Object.entries(expected).every(([key, value]) =>
        key === 'created_at'
            ? (row[key]?.getTime() ?? null) === (value?.getTime() ?? null)
            : row[key] === value,
    );
}

async function saveBackup(snapshot) {
    const directory = path.resolve('.local/backups');
    await fs.mkdir(directory, { recursive: true });
    const filename = path.join(
        directory,
        `social-accounts-${Date.now()}-${crypto.randomUUID()}.json`,
    );
    const content = JSON.stringify(
        {
            database: sequelize.config.database,
            createdAt: new Date().toISOString(),
            tables: snapshot,
        },
        null,
        2,
    );
    const file = await fs.open(filename, 'wx', 0o600);
    try {
        await file.writeFile(content, 'utf8');
        await file.sync();
    } finally {
        await file.close();
    }
    if ((await fs.readFile(filename, 'utf8')) !== content)
        throw new Error('소셜 계정 백업 검증에 실패했습니다.');
    return filename;
}

async function freezeSource(source, mapping) {
    const staging = stagingTable(source);
    const tables = await mapping.showAllTables();
    if (tables.includes(source.table) && tables.includes(staging))
        throw new Error(`${source.table} 이관 중 구형 테이블이 다시 발견되었습니다.`);
    if (!tables.includes(source.table)) return;
    try {
        // 원본 이름을 먼저 바꾸어 구버전 서버가 복사 도중 연결 정보를 추가하지 못하게 한다.
        await mapping.renameTable(source.table, staging);
    } catch (error) {
        const current = await mapping.showAllTables();
        if (current.includes(source.table)) throw error;
        // 다른 서버가 먼저 이름을 변경하거나 이관을 완료한 경우 같은 단계에서 이어간다.
    }
}

async function migrateSocialAccounts() {
    const mapping = sequelize.getQueryInterface();
    for (const source of sources) await freezeSource(source, mapping);
    const existingTables = await mapping.showAllTables();
    if (!sources.some((source) => existingTables.includes(stagingTable(source))))
        return { migrated: 0, backup: null };
    const result = await sequelize.transaction(async (transaction) => {
        // 동시에 시작한 이관은 같은 회원 행을 잠가 차례로 진행한다.
        await User.findAll({
            attributes: ['id'],
            order: [['id', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        const tables = await mapping.showAllTables({ transaction });
        const snapshot = [];
        for (const source of sources) {
            if (!tables.includes(stagingTable(source))) continue;
            try {
                const rows = await sourceModel(source).findAll({
                    raw: true,
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                });
                const columns = await mapping.describeTable(stagingTable(source), { transaction });
                snapshot.push({ ...source, columns, rows });
            } catch (error) {
                const current = await mapping.showAllTables({ transaction });
                if (current.includes(source.table) || current.includes(stagingTable(source)))
                    throw error;
                // 앞선 이관이 커밋 후 원본을 정리한 경우다.
            }
        }
        if (!snapshot.length) return { migrated: 0, backup: null, sources: [] };
        const backup = await saveBackup(snapshot);
        let migrated = 0;
        for (const source of snapshot) {
            for (const row of source.rows) {
                const values = migratedValues(source, row);
                const where = {
                    provider: values.provider,
                    app_key_hash: values.app_key_hash,
                    provider_user_id: values.provider_user_id,
                };
                let account = await SocialAccount.findOne({ where, transaction });
                if (!account) {
                    await SocialAccount.create(values, { transaction });
                    account = await SocialAccount.findOne({ where, transaction });
                }
                if (!matches(account, values))
                    throw new Error('소셜 계정 이관 대상과 기존 연결 정보가 일치하지 않습니다.');
                migrated++;
            }
        }
        return { migrated, backup, sources: snapshot.map(({ table }) => table) };
    });
    for (const source of sources.filter(({ table }) => result.sources.includes(table))) {
        const current = await mapping.showAllTables();
        if (current.includes(source.table))
            throw new Error(`${source.table} 구버전 서버를 종료한 뒤 이관을 다시 실행하세요.`);
        if (!current.includes(stagingTable(source))) continue;
        try {
            // 백업과 새 테이블 검증·커밋을 마친 원본만 제거한다. 중단된 단계는 재시도 가능하다.
            await mapping.dropTable(stagingTable(source));
        } catch (error) {
            const remaining = await mapping.showAllTables();
            if (remaining.includes(stagingTable(source)) || remaining.includes(source.table))
                throw error;
        }
    }
    return { migrated: result.migrated, backup: result.backup };
}

module.exports = { migrateSocialAccounts };
