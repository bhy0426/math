import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth';
import { Page } from '../../shared/components';
import MailSettings from './MailSettings';
import MailCompose from './MailCompose';
import GroupManager from './GroupManager';
import MemberManager from './MemberManager';
import MemberSettings from './MemberSettings';

const tabs = [
    { id: 'members', label: '회원 관리' },
    { id: 'groups', label: '회원 그룹' },
    { id: 'signup', label: '가입·로그인 설정' },
    { id: 'mail', label: '메일 관리', requiresEmail: true },
    { id: 'broadcasts', label: '메일 발송', requiresEmail: true },
];

export default function ManagerPage() {
    const [params] = useSearchParams();
    const { emailEnabled, fieldsReady } = useAuth();
    const visibleTabs = tabs.filter((tab) => !tab.requiresEmail || emailEnabled);
    const tabId = params.get('tab') || 'members';
    const active = visibleTabs.find((tab) => tab.id === tabId);
    if (!active && fieldsReady) return <Navigate to="/manager?tab=members" replace />;
    return (
        <Page title="학원 관리">
            <nav aria-label="학원 관리 기능">
                {visibleTabs.map((tab) => (
                    <Link
                        key={tab.id}
                        to={'/manager?tab=' + tab.id}
                        aria-current={tab.id === active?.id ? 'page' : undefined}
                    >
                        {tab.label}
                    </Link>
                ))}
            </nav>
            {active?.id === 'members' && <MemberManager />}
            {active?.id === 'groups' && <GroupManager />}
            {active?.id === 'signup' && <MemberSettings />}
            {active?.id === 'mail' && <MailSettings />}
            {active?.id === 'broadcasts' && <MailCompose />}
        </Page>
    );
}
