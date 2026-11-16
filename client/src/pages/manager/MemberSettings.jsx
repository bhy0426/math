import { useAuth } from '../../shared/auth';
import { api } from '../../shared/api';
import { useAction, useResource } from '../../shared/hooks';
import { Field, Form } from '../../shared/components';

export default function MemberSettings() {
    const { fields: enabledFields, fieldsReady, reloadAuth } = useAuth();
    const initial = useResource('/manager/member-fields');
    const fields =
        enabledFields &&
        initial.data?.fields.map(({ key, label }) => ({
            key,
            label,
            enabled: enabledFields.some((field) => field.key === key),
        }));
    const action = useAction();
    return (
        <section>
            <h3>회원가입·회원정보 항목 설정</h3>
            <p>
                항목을 꺼도 기존 회원 정보는 보관됩니다. 회원 목록에는 켜져 있는 닉네임, 아이디,
                이메일 순으로 처음 사용 가능한 값이 표시됩니다. 표시할 값이 없으면 회원 번호가
                보입니다.
            </p>
            <p>
                아이디 또는 이메일은 하나 이상 켜 두어야 합니다. 닉네임·아이디·이메일은 중복할 수
                없습니다.
            </p>
            <p role="status">{action.message || initial.error}</p>
            <Form
                key={JSON.stringify(fields)}
                busy={action.busy || !fieldsReady || !fields}
                onSubmit={(form, element) =>
                    action.run(async () => {
                        let result;
                        try {
                            result = await api('PATCH', '/manager/member-fields', {
                                fields: fields.map(({ key }) => ({ key, enabled: form.has(key) })),
                            });
                        } catch (error) {
                            element.reset();
                            throw error;
                        }
                        try {
                            await reloadAuth({
                                fields: result.fields.filter((field) => field.enabled),
                                canRequestResetEmail: result.canRequestResetEmail,
                            });
                        } catch (error) {
                            return {
                                message: `설정은 저장했습니다. 회원 정보 갱신 실패: ${error.message}`,
                            };
                        }
                        return result;
                    })
                }
            >
                {fields?.map(({ key, label, enabled }) => (
                    <Field
                        key={key}
                        label={`${label} 사용`}
                        name={key}
                        type="checkbox"
                        role="switch"
                        defaultChecked={enabled}
                    />
                ))}
                <button>항목 설정 저장</button>
            </Form>
        </section>
    );
}
