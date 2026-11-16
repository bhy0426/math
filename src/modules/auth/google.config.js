const crypto = require('node:crypto');

function googleConfig() {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
    let callback;
    try {
        callback = new URL(redirectUri);
    } catch {
        /* 미설정 */
    }
    return {
        clientId,
        clientSecret,
        redirectUri,
        configured: Boolean(
            clientId &&
            clientSecret &&
            callback &&
            ['http:', 'https:'].includes(callback.protocol) &&
            !callback.username &&
            !callback.password &&
            callback.pathname === '/auth/google/callback' &&
            !callback.search &&
            !callback.hash,
        ),
        appKeyHash: clientId ? crypto.createHash('sha256').update(clientId).digest('hex') : null,
    };
}

module.exports = { googleConfig };
