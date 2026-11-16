import { useState } from 'react';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/auth';
import { DeleteButton, Field, Form } from '../../shared/components';
import { useAction, useResource } from '../../shared/hooks';
import GroupAccess from './GroupAccess';
import StudentChecklist from './StudentChecklist';

export default function GroupManager() {
    const { fields } = useAuth();
    const groups = useResource('/manager/groups');
    const members = useResource('/manager/users', fields?.map((field) => field.key).join(','));
    const [groupId, setGroupId] = useState('');
    const selectedGroup = groups.data?.groups.find((group) => String(group.id) === groupId);
    const action = useAction();

    async function createGroup(form, element) {
        const result = await api('POST', '/manager/groups', { name: form.get('name') });
        element.reset();
        groups.reload();
        setGroupId(String(result.group.id));
        return result;
    }
    async function changeGroup(method, body) {
        const result = await api(method, '/manager/groups/' + selectedGroup.id, body);
        if (method === 'DELETE') setGroupId('');
        groups.reload();
        return result;
    }
    function saveMembers(changes) {
        return action.run(async () => {
            const result = await api(
                'PATCH',
                `/manager/groups/${selectedGroup.id}/members`,
                changes,
            );
            groups.reload();
            return result;
        });
    }
    return (
        <section>
            <h3>회원 그룹</h3>
            <p role="status">{action.message || groups.error || members.error}</p>
            <Form
                busy={action.busy}
                onSubmit={(form, element) => action.run(() => createGroup(form, element))}
            >
                <Field label="새 그룹 이름" name="name" maxLength={80} required />
                <button>그룹 만들기</button>
            </Form>
            <Field
                label="관리할 그룹"
                as="select"
                value={groupId}
                disabled={action.busy || !groups.data}
                onChange={(event) => setGroupId(event.target.value)}
            >
                <option value="">그룹 선택</option>
                {groups.data?.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                        {group.name} ({group.memberIds.length}명)
                    </option>
                ))}
            </Field>
            {selectedGroup && (
                <>
                    <Form
                        key={selectedGroup.id + ':' + selectedGroup.name}
                        busy={action.busy}
                        onSubmit={(form) =>
                            action.run(() => changeGroup('PATCH', { name: form.get('name') }))
                        }
                    >
                        <Field
                            label="그룹 이름"
                            name="name"
                            defaultValue={selectedGroup.name}
                            maxLength={80}
                            required
                        />
                        <button>이름 저장</button>
                        <DeleteButton
                            onDelete={() => action.run(() => changeGroup('DELETE'))}
                            confirmLabel="확인 · 회원은 유지하고 그룹 삭제"
                        >
                            그룹 삭제
                        </DeleteButton>
                    </Form>
                    {members.data && (
                        <GroupStudents
                            key={selectedGroup.id + ':' + selectedGroup.memberIds.join(',')}
                            group={selectedGroup}
                            users={members.data.users}
                            onSave={saveMembers}
                            busy={action.busy}
                        />
                    )}
                </>
            )}
        </section>
    );
}

function GroupStudents({ group, users, onSave, busy }) {
    const assigned = new Set(group.memberIds);
    const active = users.filter((user) => user.status === 'active' && !user.canManage);
    const candidates = users.filter(
        (user) => assigned.has(user.id) || (user.status === 'active' && !user.canManage),
    );
    const [selectedIds, setSelectedIds] = useState(group.memberIds);
    const addUserIds = selectedIds.filter((id) => !assigned.has(id));
    const removeUserIds = group.memberIds.filter((id) => !selectedIds.includes(id));
    return (
        <>
            <section>
                <h4>학생 배정</h4>
                <StudentChecklist
                    label={group.name + ' 소속 학생'}
                    students={candidates}
                    selectedIds={selectedIds}
                    onChange={setSelectedIds}
                    disabled={busy}
                />
                <button
                    type="button"
                    disabled={busy || (!addUserIds.length && !removeUserIds.length)}
                    onClick={() => onSave({ addUserIds, removeUserIds })}
                >
                    학생 배정 저장
                </button>
            </section>
            <GroupAccess
                group={group}
                students={active.filter((student) => assigned.has(student.id))}
                busy={busy}
            />
        </>
    );
}
