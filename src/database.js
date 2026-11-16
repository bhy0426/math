require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    dialect: 'mysql',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3307,
    logging: false,
    timezone: '+00:00',
    pool: {
        max: Number(process.env.DB_CONNECTION_LIMIT) || 1,
        min: 0,
        idle: 10000,
        acquire: 15000,
    },
    dialectOptions: {
        connectTimeout: 15000,
        ...(process.env.DB_SSL === 'true'
            ? {
                  ssl: {
                      rejectUnauthorized: true,
                      verifyIdentity: true,
                      ...(process.env.DB_SSL_CA
                          ? { ca: fs.readFileSync(process.env.DB_SSL_CA, 'utf8') }
                          : {}),
                  },
              }
            : {}),
    },
});

function isConnectionLimit(error) {
    const cause = error.original || error;
    return (
        cause.code === 'ER_TOO_MANY_USER_CONNECTIONS' ||
        (cause.code === 'ER_USER_LIMIT_REACHED' && cause.message?.includes('max_user_connections'))
    );
}

module.exports = { sequelize, isConnectionLimit };
