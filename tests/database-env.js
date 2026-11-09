const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

// 공유 개발 DB를 초기화하지 않도록 테스트는 로컬 DB만 사용한다.
dotenv.config({ quiet: true });
const localEnv = path.resolve('.env.local');
if (!fs.existsSync(localEnv)) throw new Error('테스트용 로컬 DB 설정 .env.local이 필요합니다.');
dotenv.config({ path: localEnv, override: true, quiet: true });
if (!['127.0.0.1', 'localhost'].includes(process.env.DB_HOST))
    throw new Error('테스트 DB는 로컬 주소만 허용합니다.');
process.env.DB_NAME = 'mathsite_test';
process.env.DB_SSL = 'false';
delete process.env.DB_SSL_CA;
