import { useState } from 'react';
import { api } from '../../shared/api';
import { useAction } from '../../shared/hooks';
import { DeleteButton, Field, Form } from '../../shared/components';
import { useAuth } from '../../shared/auth';
import { useResource } from '../../shared/hooks';
import MemberFields, { profileChanges } from '../../shared/MemberFields';
import { memberLabel } from '../../shared/memberLabel.mjs';

export default function MemberManager({ users, roles, lectures, onChange }) {
    const { user: currentUser, fields, fieldsReady, canRequestResetEmail, reloadAuth } = useAuth();
    const [memberId, setMemberId] = useState('');
    const [studentId, setStudentId] = useState('');
    const [lectureId, setLectureId] = useState('');
    const members = users;
    const students = members.filter((user) => !user.canManage && user.status === 'active');
    const member = members.find((user) => String(user.id) === memberId) || members[0];
    const student = students.find((user) => String(user.id) === studentId) || students[0];
    const lecture = lectures.find((row) => String(row.id) === lectureId) || lectures[0];
    const action = useAction();
    const grants = useResource(student ? `/manager/users/${student.id}/lectures` : null);
    const states = { pending: '승인 대기', active: '승인', suspended: '정지' };
    function changeStatus(status) {
        return action.run(async () => {
            const result = await api('PATCH', `/manager/users/${member.id}/status`, { status });
            onChange();
            return result;
        });
    }
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
            <h3>회원 승인·정지</h3>
            <p role="status">{action.message}</p>
            <Field
                label="회원"
                as="select"
                value={member?.id || ''}
                onChange={(event) => setMemberId(event.target.value)}
            >
                {members.map((user) => (
                    <option key={user.id} value={user.id}>
                        {memberLabel(user, fields)} — {states[user.status]}
                    </option>
                ))}
            </Field>
            {member && (
                <>
                    <p>
                        회원 번호: {member.id} · 역할: {member.roleName}
                    </p>
                    <Form
                        key={`profile-${member.id}:${JSON.stringify(fields)}:${JSON.stringify([member.username, member.nickname, member.email])}`}
                        busy={action.busy || !fieldsReady}
                        onSubmit={(form) =>
                            action.run(async () => {
                                const changes = profileChanges(form, member);
                                if (!Object.keys(changes).length)
                                    return { message: '수정한 정보가 없습니다.' };
                                const result = await api(
                                    'PATCH',
                                    `/manager/users/${member.id}`,
                                    changes,
                                );
                                onChange();
                                if (member.id === currentUser.id) await reloadAuth();
                                return result;
                            })
                        }
                    >
                        <MemberFields values={member} />
                        <button>회원정보 수정</button>
                    </Form>
                    <Form
                        key={`${member.id}:${member.roleId}`}
                        busy={action.busy}
                        onSubmit={(form) =>
                            action.run(async () => {
                                const result = await api(
                                    'PATCH',
                                    `/manager/users/${member.id}/role`,
                                    { roleId: form.get('roleId') },
                                );
                                onChange();
                                return result;
                            })
                        }
                    >
                        <Field
                            label="회원 역할"
                            as="select"
                            name="roleId"
                            defaultValue={member.roleId}
                        >
                            {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                    {role.name}
                                </option>
                            ))}
                        </Field>
                        <button disabled={member.id === currentUser.id}>역할 변경</button>
                    </Form>
                    {canRequestResetEmail && member.email && member.id !== currentUser.id && (
                        <DeleteButton
                            key={`reset-${member.id}`}
                            disabled={action.busy}
                            confirmLabel="다시 눌러 비밀번호 초기화"
                            onDelete={() =>
                                action.run(() =>
                                    api('POST', `/manager/users/${member.id}/password-reset`),
                                )
                            }
                        >
                            비밀번호 초기화 메일 발송
                        </DeleteButton>
                    )}
                    <DeleteButton
                        key={`delete-${member.id}`}
                        disabled={action.busy || member.id === currentUser.id}
                        onDelete={() =>
                            action.run(async () => {
                                const result = await api('DELETE', `/manager/users/${member.id}`);
                                setMemberId('');
                                onChange();
                                return result;
                            })
                        }
                    >
                        회원 계정 삭제
                    </DeleteButton>
                </>
            )}
            <button
                disabled={action.busy || !member || member.id === currentUser.id}
                onClick={() => changeStatus('active')}
            >
                승인·정지 해제
            </button>
            <button
                disabled={action.busy || !member || member.id === currentUser.id}
                onClick={() => changeStatus('suspended')}
            >
                정지
            </button>
            <h3>학생별 시청 권한</h3>
            <Field
                label="학생"
                as="select"
                value={student?.id || ''}
                onChange={(event) => setStudentId(event.target.value)}
            >
                {students.map((user) => (
                    <option key={user.id} value={user.id}>
                        {memberLabel(user, fields)}
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
            <button disabled={action.busy || !student || !lecture} onClick={() => access(true)}>
                30일 시청 허용
            </button>
            <button disabled={action.busy || !student || !lecture} onClick={() => access(false)}>
                권한 회수
            </button>
            {student && lecture && (
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
            <p role="status">{grants.error}</p>
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
