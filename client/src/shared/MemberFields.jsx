import { useRef, useState } from 'react';
import { useAuth } from './auth';
import { api } from './api';
import { Field } from './components';

export function profileChanges(form, member) {
    return Object.fromEntries([...form].filter(([key, value]) => value !== (member[key] ?? '')));
}

// 확인한 실제 입력값을 보관한다. 값을 바꾸면 다시 확인해야 한다.
export function useRegistrationChecks() {
    const { fields, reloadAuth } = useAuth();
    const [confirmed, setConfirmed] = useState({});
    function markChecked(key, value) {
        setConfirmed((previous) => ({ ...previous, [key]: value }));
    }
    function requireChecks(profile) {
        for (const { key, label, enabled } of fields) {
            if (enabled && (!confirmed[key] || confirmed[key] !== profile[key]))
                throw new Error(`${label} 중복 확인을 해 주세요.`);
        }
    }
    async function post(path, body) {
        try {
            return await api('POST', path, body);
        } catch (error) {
            // 열린 화면에서 가입 항목이나 가입 방식이 바뀐 경우 최신 설정으로 다시 그린다.
            if (error.status === 400 || error.status === 404) await reloadAuth();
            throw error;
        }
    }
    return { markChecked, requireChecks, post };
}

function RegistrationField({ checks, ...props }) {
    const [message, setMessage] = useState('');
    const revision = useRef(0);
    function clear() {
        revision.current++;
        checks.markChecked(props.name, null);
        setMessage('');
    }
    async function check(event) {
        const input = event.currentTarget.form.elements.namedItem(props.name);
        if (!input.reportValidity()) return;
        const value = input.value;
        const request = ++revision.current;
        checks.markChecked(props.name, null);
        setMessage('확인 중…');
        try {
            const result = await checks.post('/auth/register/check', { field: props.name, value });
            if (revision.current !== request || input.value !== value) return;
            checks.markChecked(props.name, value);
            setMessage(result.message);
        } catch (error) {
            if (revision.current === request && input.value === value) setMessage(error.message);
        }
    }
    return (
        <div>
            <Field {...props} onChange={clear} />
            <button type="button" aria-label={props.label + ' 중복 확인'} onClick={check}>
                중복 확인
            </button>
            <span role="status">{message}</span>
        </div>
    );
}

// 가입·내 정보·관리자 수정에서 같은 설정과 입력 모양을 사용한다.
export default function MemberFields({ values, checks }) {
    const { fields } = useAuth();
    const Input = checks ? RegistrationField : Field;
    return fields
        ?.filter((field) => field.enabled)
        .map(({ key, label }) => (
            <Input
                key={key}
                {...(checks && { checks })}
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
