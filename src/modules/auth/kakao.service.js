const { createSocialService } = require('./social.service');
const { kakaoConfig } = require('./kakao.config');
module.exports = createSocialService(
    'kakao',
    kakaoConfig,
    require('./kakao.client'),
    require('./kakao.repository'),
);
