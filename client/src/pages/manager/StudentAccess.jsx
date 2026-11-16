import { useState } from 'react';
import { api } from '../../shared/api';
import { Field, Form } from '../../shared/components';
import { useAction, useResource } from '../../shared/hooks';

export default function StudentAccess({ student }) {
    const [courseId, setCourseId] = useState('');
    const [lectureId, setLectureId] = useState('');
    const courses = useResource('/courses');
    const rows = courses.data?.courses || [];
    const course = rows.find((row) => String(row.id) === courseId) || rows[0];
    const list = useResource(course ? `/courses/${course.id}/lectures` : null);
    const lectures = list.data?.lectures || [];
    const lecture = lectures.find((row) => String(row.id) === lectureId) || lectures[0];
    const grants = useResource(`/manager/users/${student.id}/lectures`);
    const action = useAction();
    function access(grant, targetId = lecture?.id, expiresAt) {
        return action.run(async () => {
            const result = await api(
                grant ? 'POST' : 'DELETE',
                `/manager/users/${student.id}/lectures` + (grant ? '' : '/' + targetId),
                grant ? { lectureId: targetId, ...(expiresAt ? { expiresAt } : {}) } : undefined,
            );
            grants.reload();
            return result;
        });
    }
    return (
        <section>
            <h3>선택한 학생의 시청 권한</h3>
            <p role="status">{action.message || courses.error || list.error || grants.error}</p>
            <Field
                label="시청 권한 관리 대상 강좌"
                as="select"
                value={course?.id || ''}
                onChange={(event) => setCourseId(event.target.value)}
            >
                {rows.map((row) => (
                    <option key={row.id} value={row.id}>
                        {row.title}
                    </option>
                ))}
            </Field>
            <Field
                label="강의"
                as="select"
                value={lecture?.id || ''}
                onChange={(event) => setLectureId(event.target.value)}
            >
                {lectures.map((row) => (
                    <option key={row.id} value={row.id}>
                        {row.title}
                    </option>
                ))}
            </Field>
            <button disabled={action.busy || !lecture} onClick={() => access(true)}>
                30일 시청 허용
            </button>
            <button disabled={action.busy || !lecture} onClick={() => access(false)}>
                권한 회수
            </button>
            {lecture && (
                <Form
                    busy={action.busy}
                    onSubmit={(form) =>
                        access(true, lecture.id, new Date(form.get('expiresAt')).toISOString())
                    }
                >
                    <Field
                        label="시청 만료일 지정"
                        name="expiresAt"
                        type="datetime-local"
                        required
                    />
                    <button>지정한 만료일까지 허용</button>
                </Form>
            )}
            <ul>
                {grants.data?.access.map((item) => (
                    <li key={item.lecture_id}>
                        {item.title} · {new Date(item.expires_at).toLocaleString()}까지 ·{' '}
                        {item.valid ? '유효' : '만료·예정'}
                        <button
                            disabled={action.busy}
                            onClick={() => access(false, item.lecture_id)}
                        >
                            이 권한 회수
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}
