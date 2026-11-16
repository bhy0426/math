import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useResource } from '../shared/hooks';
import { Field, Form, Page } from '../shared/components';

export default function CoursesPage() {
    const { courseId } = useParams();
    const [search, setSearch] = useState('');
    const courses = useResource(
        courseId ? `/courses/${courseId}` : '/courses?q=' + encodeURIComponent(search),
    );
    const lectures = useResource(
        courseId ? `/courses/${courseId}/lectures?q=${encodeURIComponent(search)}` : null,
    );
    const data = courses.data;
    return (
        <Page
            title={courseId ? '강좌 상세' : '강좌 목록'}
            message={courses.error || lectures.error}
        >
            {
                <Form onSubmit={(form) => setSearch(form.get('q'))}>
                    <Field label={courseId ? '강의 영상 검색' : '강좌 검색'} name="q" />
                    <button>검색</button>
                </Form>
            }
            {!data && !courses.error && <p>불러오는 중…</p>}
            {courseId && data && (
                <>
                    <h3>{data.course.title}</h3>
                    <p>{data.course.description}</p>
                </>
            )}
            <ul>
                {(courseId ? lectures.data?.lectures : data?.courses)?.map((item) => (
                    <li key={item.id}>
                        <Link
                            to={
                                courseId
                                    ? `/courses/${courseId}/lectures/${item.id}`
                                    : `/courses/${item.id}`
                            }
                        >
                            {item.title}
                        </Link>
                    </li>
                ))}
            </ul>
            {!courseId && data?.courses.length === 0 && (
                <p>시청이 허용된 강좌가 없습니다. 관리자에게 문의하세요.</p>
            )}
        </Page>
    );
}
