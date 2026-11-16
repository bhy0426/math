import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api';
import { DeleteButton, Field, Form } from '../../shared/components';
import { useAction } from '../../shared/hooks';

export default function CourseEditor({ course, onChange }) {
    const action = useAction();
    const navigate = useNavigate();
    const path = course ? `/courses/${course.id}` : '/courses';

    function save(form) {
        return action.run(async () => {
            const result = await api(course ? 'PATCH' : 'POST', path, {
                title: form.get('title'),
                description: form.get('description'),
                teacher: form.get('teacher'),
                isPublished: form.has('isPublished'),
            });
            if (course) onChange();
            else navigate(`/courses/${result.course.id}`);
            return result;
        });
    }

    function remove() {
        return action.run(async () => {
            await api('DELETE', path);
            navigate('/courses');
        });
    }

    return (
        <details>
            <summary>{course ? '강좌 수정' : '강좌 추가'}</summary>
            <Form onSubmit={save} busy={action.busy}>
                <Field
                    label="강좌명"
                    name="title"
                    defaultValue={course?.title}
                    maxLength={160}
                    required
                />
                <Field label="강사" name="teacher" defaultValue={course?.teacher} maxLength={80} />
                <Field
                    label="소개"
                    name="description"
                    as="textarea"
                    defaultValue={course?.description}
                    maxLength={10000}
                    required
                />
                <Field
                    label="강좌 공개"
                    name="isPublished"
                    type="checkbox"
                    defaultChecked={course ? Boolean(course.is_published) : true}
                />
                <button>저장</button>
                {course && (
                    <DeleteButton onDelete={remove} confirmLabel="강의까지 모두 삭제">
                        강좌 삭제
                    </DeleteButton>
                )}
            </Form>
            {action.message && <p role="status">{action.message}</p>}
        </details>
    );
}
