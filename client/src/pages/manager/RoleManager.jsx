import { api } from '../../shared/api';
import { useAction } from '../../shared/hooks';
import { DeleteButton, Field, Form } from '../../shared/components';

export default function RoleManager({ roles, onChange }) {
    const action = useAction();
    function save(method, body) {
        return action.run(async () => {
            const result = await api(method, '/manager', body);
            onChange();
            return result;
        });
    }
    return (
        <section>
            <h3>역할 관리</h3>
            <p role="status">{action.message}</p>
            <p>역할은 계정 분류입니다. 영상 시청 권한은 학생별로 별도 부여합니다.</p>
            {roles.map((role) => (
                <Form
                    key={`${role.id}:${role.name}`}
                    busy={action.busy}
                    onSubmit={(form) => save('PATCH', { roleId: role.id, name: form.get('name') })}
                >
                    <p>
                        {role.code} {role.can_manage ? '· 관리자 역할' : ''}
                    </p>
                    <Field
                        label="역할 이름"
                        name="name"
                        defaultValue={role.name}
                        maxLength={80}
                        required
                    />
                    <button>이름 수정</button>
                    {!['admin', 'student'].includes(role.code) && (
                        <DeleteButton onDelete={() => save('DELETE', { roleId: role.id })} />
                    )}
                </Form>
            ))}
            <Form busy={action.busy} onSubmit={(form) => save('POST', Object.fromEntries(form))}>
                <Field label="새 역할 코드" name="code" pattern="[a-z][a-z0-9_]{1,39}" required />
                <Field label="새 역할 이름" name="name" maxLength={80} required />
                <button>일반 역할 추가</button>
            </Form>
        </section>
    );
}
