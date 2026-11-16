import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth';
import { Field, Form, Page } from '../../shared/components';
import { useResource } from '../../shared/hooks';
import CourseEditor from './CourseEditor';
import LectureEditor from './LectureEditor';

export default function CoursesPage() {
    const { courseId } = useParams();
    const { user } = useAuth();
    const [editMode, setEditMode] = useState(false);
    const viewer = `${user.id}:${user.canManage}`;
    const editing = user.canManage && editMode;
    const editToggle = user.canManage && (
        <button type="button" aria-pressed={editing} onClick={() => setEditMode(!editMode)}>
            {editing ? '편집 모드 종료' : '편집 모드'}
        </button>
    );
    return courseId ? (
        <CourseDetail
            key={`${viewer}:${courseId}`}
            courseId={courseId}
            editing={editing}
            editToggle={editToggle}
        />
    ) : (
        <CourseList key={viewer} editing={editing} editToggle={editToggle} />
    );
}

function SearchForm({ label, onSearch }) {
    return (
        <Form onSubmit={(form) => onSearch(form.get('q').trim())}>
            <Field label={label} name="q" type="search" maxLength={160} />
            <button>검색</button>
        </Form>
    );
}

function CourseList({ editing, editToggle }) {
    const [search, setSearch] = useState('');
    const courses = useResource('/courses?q=' + encodeURIComponent(search));
    return (
        <Page title="강좌 목록" message={courses.error}>
            {editToggle}
            {editing && <CourseEditor />}
            <SearchForm label="강좌 검색" onSearch={setSearch} />
            {!courses.data && !courses.error && <p>불러오는 중…</p>}
            <ul>
                {courses.data?.courses.map((course) => (
                    <li key={course.id}>
                        <Link to={`/courses/${course.id}`}>{course.title}</Link>
                        {editing && !course.is_published && ' · 비공개'}
                    </li>
                ))}
            </ul>
            {courses.data?.courses.length === 0 && (
                <p>{search ? '검색 결과가 없습니다.' : '볼 수 있는 강좌가 없습니다.'}</p>
            )}
        </Page>
    );
}

function CourseDetail({ courseId, editing, editToggle }) {
    const [search, setSearch] = useState('');
    const base = `/courses/${courseId}`;
    const course = useResource(base);
    const lectures = useResource(
        course.data ? `${base}/lectures?q=${encodeURIComponent(search)}` : null,
    );
    const processing =
        editing &&
        !lectures.error &&
        lectures.data?.lectures.some((row) => row.videoStatus === 'PROCESSING');
    useEffect(() => {
        if (!processing) return;
        const timer = setInterval(lectures.reload, 3000);
        return () => clearInterval(timer);
    }, [processing, lectures.reload]);

    return (
        <Page
            title={course.data?.course.title || '강좌 상세'}
            message={course.error || lectures.error}
        >
            <Link to="/courses">강좌 목록</Link>
            {course.data && (
                <>
                    {editToggle}
                    <p className="content">{course.data.course.description}</p>
                    {editing && (
                        <CourseEditor course={course.data.course} onChange={course.reload} />
                    )}
                    <SearchForm label="강의 영상 검색" onSearch={setSearch} />
                    <ul>
                        {lectures.data?.lectures.map((lecture) => (
                            <li key={lecture.id}>
                                <Link to={`${base}/lectures/${lecture.id}`}>{lecture.title}</Link>
                                {editing && (
                                    <LectureEditor
                                        courseId={courseId}
                                        lecture={lecture}
                                        onChange={lectures.reload}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                    {lectures.data?.lectures.length === 0 && (
                        <p>{search ? '검색 결과가 없습니다.' : '표시할 강의가 없습니다.'}</p>
                    )}
                    {editing && <LectureEditor courseId={courseId} onChange={lectures.reload} />}
                </>
            )}
        </Page>
    );
}
