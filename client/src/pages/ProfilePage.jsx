import { useAuth } from '../shared/auth';
import { api } from '../shared/api';
import { useAction, useResource } from '../shared/hooks';
import { Field, Form, Page } from '../shared/components';
import MemberFields, { profileChanges } from '../shared/MemberFields';

export default function ProfilePage() {
    const { user, setUser, fields, fieldsReady } = useAuth();
    const status = useResource('/auth/kakao/status');
    const google = useResource('/auth/google/status');
    const action = useAction();
    return (
        <Page title="내 정보" message={action.message || status.error}>
            <Form
                key={JSON.stringify(fields)}
                busy={action.busy || !fieldsReady}
                onSubmit={(form) =>
                    action.run(async () => {
                        const changes = profileChanges(form, user);
                        if (!Object.keys(changes).length)
                            return { message: '수정한 정보가 없습니다.' };
                        const result = await api('PATCH', '/user', changes);
                        setUser(result.user);
                        return result;
                    })
                }
            >
                <MemberFields values={user} />
                <button>저장</button>
            </Form>
            {status.data?.configured && !status.data.linked && (
                <p>
                    <a href="/auth/kakao/link">현재 계정에 카카오 연결</a>
                </p>
            )}
            {google.data?.configured && !google.data.linked && (
                <p>
                    <a href="/auth/google/link">현재 계정에 구글 연결</a>
                </p>
            )}
            {(status.data?.configured || google.data?.configured) && (
                <p>비밀번호를 잊었을 때 소셜 인증을 사용하려면 해당 계정을 미리 연결하세요.</p>
            )}
        </Page>
    );
}
