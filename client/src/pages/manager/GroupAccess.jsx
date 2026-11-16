import { useState } from 'react';
import { api } from '../../shared/api';
import { DeleteButton, Field, Form } from '../../shared/components';
import { useAction, useResource } from '../../shared/hooks';
import StudentChecklist from './StudentChecklist';

export default function GroupAccess({ group, students, busy }) {
    const courses = useResource('/courses');
    const [courseId, setCourseId] = useState('');
    const [userIds, setUserIds] = useState(() => students.map((student) => student.id));
    const lectures = useResource(courseId ? `/courses/${courseId}/lectures` : null);
    const selectedUsers = students
        .filter((student) => userIds.includes(student.id))
        .map((student) => student.id);
    const action = useAction();
    const disabled = busy || action.busy;
    return (
        <section>
            <h4>그룹 시청 권한</h4>
            <p>
                이번에 선택한 학생과 강의에 시청 권한을 적용합니다. 나중에 그룹에 추가한 학생은 따로
                선택해 주세요.
            </p>
            <StudentChecklist
                label="권한을 바꿀 학생"
                students={students}
                selectedIds={selectedUsers}
                onChange={setUserIds}
                disabled={disabled}
            />
            <Field
                label="강좌 선택"
                as="select"
                value={courseId}
                disabled={disabled}
                onChange={(event) => setCourseId(event.target.value)}
            >
                <option value="">강좌 선택</option>
                {courses.data?.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                        {course.title}
                    </option>
                ))}
            </Field>
            <p role="status">{courses.error || lectures.error || action.message}</p>
            {lectures.data && (
                <LectureSelection
                    key={courseId}
                    groupId={group.id}
                    userIds={selectedUsers}
                    lectures={lectures.data.lectures}
                    action={action}
                    disabled={disabled}
                />
            )}
        </section>
    );
}

function LectureSelection({ groupId, userIds, lectures, action, disabled }) {
    const [lectureIds, setLectureIds] = useState([]);
    const selectedLectures = lectures
        .filter((item) => lectureIds.includes(item.id))
        .map((item) => item.id);
    const canApply = userIds.length > 0 && selectedLectures.length > 0;
    if (!lectures.length) return <p>이 강좌에 등록된 강의가 없습니다.</p>;

    function apply(change, expiry) {
        return action.run(() =>
            api('POST', `/manager/groups/${groupId}/access`, {
                action: change,
                userIds,
                lectureIds: selectedLectures,
                ...(expiry && { expiresAt: new Date(expiry).toISOString() }),
            }),
        );
    }
    return (
        <Form busy={disabled} onSubmit={(form) => apply('grant', form.get('expiresAt'))}>
            <fieldset>
                <legend>권한을 바꿀 강의</legend>
                <button
                    type="button"
                    onClick={() =>
                        setLectureIds(
                            selectedLectures.length === lectures.length
                                ? []
                                : lectures.map((item) => item.id),
                        )
                    }
                >
                    {selectedLectures.length === lectures.length
                        ? '강의 전체 해제'
                        : '강의 전체 선택'}
                </button>
                {lectures.map((item) => (
                    <label key={item.id}>
                        <input
                            type="checkbox"
                            checked={lectureIds.includes(item.id)}
                            onChange={(event) =>
                                setLectureIds(
                                    event.target.checked
                                        ? [...lectureIds, item.id]
                                        : lectureIds.filter((id) => id !== item.id),
                                )
                            }
                        />{' '}
                        {item.title}
                    </label>
                ))}
            </fieldset>
            <Field label="시청 만료일 (기본 30일)" name="expiresAt" type="datetime-local" />
            <p>
                선택한 학생 {userIds.length}명 · 강의 {selectedLectures.length}개
            </p>
            <button disabled={!canApply}>시청 허용</button>
            <DeleteButton
                key={userIds.join(',') + ':' + selectedLectures.join(',')}
                disabled={!canApply}
                confirmLabel="확인 · 선택한 권한 회수"
                onDelete={() => apply('revoke')}
            >
                시청 권한 회수
            </DeleteButton>
        </Form>
    );
}
