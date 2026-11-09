const fs = require('node:fs/promises');
const path = require('node:path');
const { pool, query } = require('../src/database');
const { text, email, hashPassword } = require('../src/shared/helpers');

async function initialize() {
    const schema = await fs.readFile(path.join(__dirname, '../database/schema.sql'), 'utf8');
    for (const statement of schema
        .split(';')
        .map((value) => value.trim())
        .filter(Boolean))
        await pool.query(statement);
    await query(
        "INSERT IGNORE INTO roles (code, name, can_manage) VALUES ('admin', '관리자', TRUE), ('student', '학생', FALSE)",
    );
}

async function createInitialAdmin() {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
    const [existing] = await query('SELECT COUNT(*) AS total FROM users');
    if (existing.total) return;
    const [role] = await query("SELECT id FROM roles WHERE code = 'admin'");
    await query(
        "INSERT INTO users (name, email, password_hash, role_id, status) VALUES (?, ?, ?, ?, 'active')",
        [
            text(process.env.ADMIN_NAME || '관리자', '이름', 80),
            email(process.env.ADMIN_EMAIL),
            await hashPassword(process.env.ADMIN_PASSWORD),
            role.id,
        ],
    );
}

module.exports = { initialize };

if (require.main === module) {
    initialize()
        .then(createInitialAdmin)
        .then(() => console.log('DB 준비 완료: 기존 데이터 유지'))
        .catch((error) => {
            console.error(error.code || error.message);
            process.exitCode = 1;
        })
        .finally(() => pool.end());
}
