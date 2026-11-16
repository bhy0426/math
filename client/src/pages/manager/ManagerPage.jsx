import { useEffect, useState } from 'react';
import { useResource } from '../../shared/hooks';
import { Field, Page } from '../../shared/components';
import MemberManager from './MemberManager';
import CourseManager from './CourseManager';
import LectureManager from './LectureManager';
import RoleManager from './RoleManager';
import MemberSettings from './MemberSettings';
import { useAuth } from '../../shared/auth';

export default function ManagerPage() {
    const [tab, setTab] = useState('members');
    const { fields } = useAuth();
    const members = useResource('/manager/users', fields?.map((field) => field.key).join(','));
    const roles = useResource('/manager');
    const courses = useResource('/courses');
    const [selectedId, setSelectedId] = useState('');
    const rows = courses.data?.courses || [];
    const course = rows.find((row) => String(row.id) === String(selectedId)) || rows[0];
    const lectures = useResource(course ? `/courses/${course.id}/lectures` : null);
    const processing =
        !lectures.error &&
        lectures.data?.lectures.some((item) => item.videoStatus === 'PROCESSING');
    useEffect(() => {
        if (!processing) return;
        const timer = setInterval(lectures.reload, 3000);
        return () => clearInterval(timer);
    }, [processing, lectures.reload]);
    return (
        <Page title="관리자" message={members.error || courses.error || lectures.error}>
            <nav aria-label="관리자 기능">
                <button aria-pressed={tab === 'members'} onClick={() => setTab('members')}>
                    회원 탭
                </button>
                <button aria-pressed={tab === 'courses'} onClick={() => setTab('courses')}>
                    강좌 탭
                </button>
            </nav>
            {tab === 'members' && (
                <>
                    <MemberSettings />
                    <Field
                        label="시청 권한 관리 대상 강좌"
                        as="select"
                        value={course?.id || ''}
                        onChange={(event) => setSelectedId(event.target.value)}
                    >
                        {rows.map((row) => (
                            <option key={row.id} value={row.id}>
                                {row.title}
                            </option>
                        ))}
                    </Field>
                    <MemberManager
                        users={members.data?.users || []}
                        roles={roles.data?.roles || []}
                        lectures={lectures.data?.lectures || []}
                        onChange={members.reload}
                    />
                    <RoleManager
                        roles={roles.data?.roles || []}
                        onChange={() => {
                            roles.reload();
                            members.reload();
                        }}
                    />
                </>
            )}
            {tab === 'courses' && (
                <>
                    <CourseManager
                        courses={rows}
                        course={course}
                        onSelect={setSelectedId}
                        onChange={courses.reload}
                    />
                    {course && (
                        <LectureManager
                            key={course.id}
                            course={course}
                            lectures={lectures.data?.lectures || []}
                            onChange={lectures.reload}
                        />
                    )}
                </>
            )}
        </Page>
    );
}
