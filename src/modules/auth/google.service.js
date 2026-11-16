const { createSocialService } = require('./social.service');
const { googleConfig } = require('./google.config');
module.exports = createSocialService(
    'google',
    googleConfig,
    require('./google.client'),
    require('./google.repository'),
);
