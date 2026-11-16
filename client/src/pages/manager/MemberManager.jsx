import { useState } from 'react';
import { api } from '../../shared/api';
import { useAction, useResource } from '../../shared/hooks';
import { DeleteButton, Field, Form } from '../../shared/components';
import { useAuth } from '../../shared/auth';
import RoleManager from './RoleManager';
import StudentAccess from './StudentAccess';
import MemberFields, { profileChanges } from '../../shared/MemberFields';
import { memberLabel } from '../../shared/memberLabel.mjs';

export default function MemberManager() {
    const { user: currentUser, fields, fieldsReady, canRequestResetEmail, reloadAuth } = useAuth();
    const [memberId, setMemberId] = useState('');
    const membersList = useResource('/manager/users', fields?.map((field) => field.key).join(','));
    const roleList = useResource('/manager');
    const members = membersList.data?.users || [];
    const roles = roleList.data?.roles || [];
    const member = members.find((user) => String(user.id) === memberId) || members[0];
    const action = useAction();
    const states = { pending: '승인 대기', active: '승인', suspended: '정지' };
    function changeStatus(status) {
        return action.run(async () => {
            const result = await api('PATCH', `/manager/users/${member.id}/status`, { status });
            membersList.reload();
            return result;
        });
    }
    return (
        <section>
            <h3>회원 승인·정지</h3>
            <p role="status">{action.message || membersList.error || roleList.error}</p>
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
                                membersList.reload();
                                if (member.id === currentUser.id) await reloadAuth();
                                return result;
                            })
                        }
                    >
                        <MemberFields values={member} />
                        <button>회원정보 수정</button>
                    </Form>
                    {member.id !== currentUser.id && (
                        <MemberRole
                            key={`${member.id}:${member.roleId}`}
                            currentRoleId={member.roleId}
                            roles={roles}
                            busy={action.busy}
                            onSave={(roleId) =>
                                action.run(async () => {
                                    const result = await api(
                                        'PATCH',
                                        `/manager/users/${member.id}/role`,
                                        { roleId },
                                    );
                                    membersList.reload();
                                    return result;
                                })
                            }
                        />
                    )}
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
                                membersList.reload();
                                return result;
                            })
                        }
                    >
                        회원 계정 삭제
                    </DeleteButton>
                </>
            )}
            {member && member.id !== currentUser.id && (
                <>
                    {member.status !== 'active' && (
                        <button disabled={action.busy} onClick={() => changeStatus('active')}>
                            {member.status === 'pending' ? '가입 승인' : '정지 해제'}
                        </button>
                    )}
                    {member.status !== 'suspended' && (
                        <button disabled={action.busy} onClick={() => changeStatus('suspended')}>
                            정지
                        </button>
                    )}
                </>
            )}
            {member?.status === 'active' && !member.canManage && (
                <StudentAccess key={member.id} student={member} />
            )}
            <RoleManager
                roles={roles}
                onChange={() => {
                    roleList.reload();
                    membersList.reload();
                }}
            />
        </section>
    );
}

function MemberRole({ currentRoleId, roles, busy, onSave }) {
    const current = String(currentRoleId);
    const [roleId, setRoleId] = useState(current);
    return (
        <Form busy={busy} onSubmit={() => onSave(roleId)}>
            <Field
                label="회원 역할"
                as="select"
                name="roleId"
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
            >
                {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                        {role.name}
                    </option>
                ))}
            </Field>
            <button disabled={roleId === current}>역할 변경</button>
        </Form>
    );
}
