const { createSocialService } = require('./social.service');
const { kakaoConfig } = require('./kakao.config');
const { createSocialRepository } = require('./social.repository');
module.exports = createSocialService(
    'kakao',
    kakaoConfig,
    require('./kakao.client'),
    createSocialRepository('kakao'),
);
