import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function VideoPlayer({ src, format, onError }) {
    const video = useRef(null);
    useEffect(() => {
        const element = video.current;
        if (format !== 'hls' || element.canPlayType('application/vnd.apple.mpegurl')) {
            element.src = src;
            return () => {
                element.removeAttribute('src');
                element.load();
            };
        }
        if (!Hls.isSupported()) {
            onError('이 브라우저에서는 영상 형식을 지원하지 않습니다.');
            return;
        }
        const player = new Hls();
        player.loadSource(src);
        player.attachMedia(element);
        player.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                player.stopLoad();
                onError('영상을 불러올 수 없습니다. 로그인·시청 권한을 확인한 뒤 다시 접속하세요.');
            }
        });
        return () => player.destroy();
    }, [src, format, onError]);
    return (
        <video
            ref={video}
            controls
            preload="metadata"
            onError={() => onError('영상 재생에 실패했습니다.')}
        />
    );
}
