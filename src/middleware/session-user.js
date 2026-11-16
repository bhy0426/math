const { currentAccount } = require('../modules/auth/service');
const { regenerateSession } = require('../modules/auth/session');

async function currentUser(req, res, next) {
    if (req.session.userId) {
        const user = await currentAccount(req);
        if (user) req.user = user;
        else {
            await regenerateSession(req);
            res.clearCookie('mathsite.sid');
        }
    }
    next();
}

function sameOrigin(req, res, next) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin')) {
        let origin;
        try {
            origin = new URL(req.get('origin'));
        } catch {
            return res.status(403).json({ message: '올바르지 않은 요청 출처입니다.' });
        }
        if (origin.host !== req.get('host') || origin.protocol !== `${req.protocol}:`) {
            return res.status(403).json({ message: '다른 출처의 변경 요청은 허용하지 않습니다.' });
        }
    }
    next();
}

module.exports = { currentUser, sameOrigin };
