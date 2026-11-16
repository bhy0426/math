import { api } from '../../shared/api';
import { useAction } from '../../shared/hooks';
import { DeleteButton, Field, Form } from '../../shared/components';

export default function CourseManager({ courses, course, onSelect, onChange }) {
    const action = useAction();
    return (
        <section>
            <h3>강좌 관리</h3>
            <p role="status">{action.message}</p>
            <Field
                label="강좌"
                as="select"
                value={course?.id || ''}
                onChange={(event) => onSelect(event.target.value)}
            >
                {courses.map((row) => (
                    <option key={row.id} value={row.id}>
                        {row.title}
                    </option>
                ))}
            </Field>
            <Form
                key={course?.id || 'new'}
                busy={action.busy}
                onSubmit={(form) =>
                    action.run(async () => {
                        const create = form.get('action') === 'create';
                        const body = {
                            title: form.get('title'),
                            description: form.get('description'),
                            teacher: form.get('teacher'),
                            isPublished: form.has('isPublished'),
                        };
                        const result = await api(
                            create ? 'POST' : 'PATCH',
                            '/courses' + (create ? '' : '/' + course.id),
                            body,
                        );
                        if (create) onSelect(result.course.id);
                        onChange();
                        return result;
                    })
                }
            >
                <Field
                    label="강좌명"
                    name="title"
                    defaultValue={course?.title || ''}
                    maxLength={160}
                    required
                />
                <Field
                    label="강사"
                    name="teacher"
                    defaultValue={course?.teacher || ''}
                    maxLength={80}
                />
                <Field
                    label="소개"
                    name="description"
                    as="textarea"
                    defaultValue={course?.description || ''}
                    required
                />
                {course && (
                    <button name="action" value="update">
                        선택 강좌 수정
                    </button>
                )}
                <Field
                    label="강좌 공개"
                    name="isPublished"
                    type="checkbox"
                    defaultChecked={course ? Boolean(course.is_published) : true}
                />
                <button name="action" value="create">
                    새 강좌 추가
                </button>
                {course && (
                    <DeleteButton
                        key={course.id}
                        onDelete={() =>
                            action.run(async () => {
                                const result = await api('DELETE', '/courses/' + course.id);
                                onSelect('');
                                onChange();
                                return result;
                            })
                        }
                    >
                        강좌 삭제
                    </DeleteButton>
                )}
            </Form>
        </section>
    );
}
