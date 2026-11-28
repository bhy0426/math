import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './shared/auth';
import { WordPressAdminBar } from './shared/wordpress';
import './style.css';

// WordPress 블록 편집기로 쓴 페이지 본문의 기본 모양(버튼, 열, 이미지 등). nginx가 WordPress에서 제공한다.
document.head.prepend(
    Object.assign(document.createElement('link'), {
        rel: 'stylesheet',
        href: '/wp-includes/css/dist/block-library/style.min.css',
    }),
);

createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <WordPressAdminBar>
            <AuthProvider>
                <App />
            </AuthProvider>
        </WordPressAdminBar>
    </BrowserRouter>,
);
