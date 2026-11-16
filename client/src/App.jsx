import { Link, Route, Routes } from 'react-router-dom';
import { Layout, Page } from './shared/components';
import { RequireUser } from './shared/auth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPage from './pages/ResetPage';
import ProfilePage from './pages/ProfilePage';
import CoursesPage from './pages/CoursesPage';
import LecturePage from './pages/LecturePage';
import BoardsPage from './pages/BoardsPage';
import InfoPage from './pages/InfoPage';
import ManagerPage from './pages/manager/ManagerPage';

export default function App() {
    return (
        <Layout>
            <Routes>
                <Route
                    path="/"
                    element={
                        <Page title="MathSite">
                            <p>관리자가 허용한 수학 강의를 온라인으로 학습할 수 있습니다.</p>
                            <p>
                                <Link to="/info">학원 소개</Link> ·{' '}
                                <Link to="/courses">강좌 보기</Link> ·{' '}
                                <Link to="/boards">공지사항</Link>
                            </p>
                        </Page>
                    }
                />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/reset" element={<ResetPage />} />
                <Route path="/info" element={<InfoPage />} />
                <Route
                    path="/user"
                    element={
                        <RequireUser>
                            <ProfilePage />
                        </RequireUser>
                    }
                />
                <Route
                    path="/courses"
                    element={
                        <RequireUser>
                            <CoursesPage />
                        </RequireUser>
                    }
                />
                <Route
                    path="/courses/:courseId"
                    element={
                        <RequireUser>
                            <CoursesPage />
                        </RequireUser>
                    }
                />
                <Route
                    path="/courses/:courseId/lectures/:lectureId"
                    element={
                        <RequireUser>
                            <LecturePage />
                        </RequireUser>
                    }
                />
                <Route
                    path="/boards"
                    element={
                        <RequireUser>
                            <BoardsPage />
                        </RequireUser>
                    }
                />
                <Route
                    path="/manager"
                    element={
                        <RequireUser admin>
                            <ManagerPage />
                        </RequireUser>
                    }
                />
                <Route
                    path="*"
                    element={
                        <Page title="페이지를 찾을 수 없습니다">
                            <Link to="/">메인으로</Link>
                        </Page>
                    }
                />
            </Routes>
        </Layout>
    );
}
