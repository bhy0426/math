const { createSocialService } = require('./social.service');
const { googleConfig } = require('./google.config');
const { createSocialRepository } = require('./social.repository');
module.exports = createSocialService(
    'google',
    googleConfig,
    require('./google.client'),
    createSocialRepository('google'),
);
