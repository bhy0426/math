require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');
const fs = require('node:fs');

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3307,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    timezone: 'Z',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 2,
    maxIdle: 1,
    idleTimeout: 30000,
    connectTimeout: 15000,
    ssl:
        process.env.DB_SSL === 'true'
            ? {
                  rejectUnauthorized: true,
                  ...(process.env.DB_SSL_CA
                      ? { ca: fs.readFileSync(process.env.DB_SSL_CA, 'utf8') }
                      : {}),
              }
            : undefined,
});

async function query(sql, values = []) {
    const [rows] = await pool.execute(sql, values);
    return rows;
}

module.exports = { pool, query };
