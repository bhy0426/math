import { useAuth } from './auth';
import { Field } from './components';

export function profileChanges(form, member) {
    return Object.fromEntries([...form].filter(([key, value]) => value !== (member[key] ?? '')));
}

// 가입·내 정보·관리자 수정에서 같은 설정과 입력 모양을 사용한다.
export default function MemberFields({ values }) {
    const { fields } = useAuth();
    return fields
        ?.filter((field) => field.enabled)
        .map(({ key, label }) => (
            <Field
                key={key}
                label={label}
                name={key}
                defaultValue={values?.[key] || ''}
                type={key === 'email' ? 'email' : 'text'}
                maxLength={key === 'nickname' ? 80 : key === 'username' ? 40 : 254}
                pattern={key === 'username' ? '[a-z][a-z0-9_]{3,39}' : undefined}
                autoComplete={
                    key === 'username' ? 'username' : key === 'email' ? 'email' : 'nickname'
                }
                required={!values || Boolean(values[key])}
            />
        ));
}
