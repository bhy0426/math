import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    root: fileURLToPath(new URL('./client', import.meta.url)),
    envDir: false, // 서버의 DB 비밀번호와 카카오 시크릿을 프론트 빌드에서 읽지 않는다.
    plugins: [react()],
    // 개발 중에도 Local nginx 주소(mathsite.local)로 접속한다. docs/wordpress.md
    server: { allowedHosts: ['mathsite.local'] },
    build: {
        outDir: fileURLToPath(new URL('./dist/client', import.meta.url)),
        emptyOutDir: true,
    },
});
