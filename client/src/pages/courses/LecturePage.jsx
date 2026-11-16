import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/auth';
import { Page } from '../../shared/components';
import VideoPlayer from './VideoPlayer';

export default function LecturePage() {
    const { courseId, lectureId } = useParams();
    const { user } = useAuth();
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        setResult(null);
        setError('');
        api('POST', `/courses/${courseId}/lectures/${lectureId}/playback`).then(
            (data) => active && setResult(data),
            (error) => active && setError(error.message),
        );
        return () => {
            active = false;
        };
    }, [courseId, lectureId, user.id, user.canManage]);
    return (
        <Page title="강의 시청" message={error}>
            <Link to={`/courses/${courseId}`}>강좌로 돌아가기</Link>
            {result && (
                <>
                    <h3>{result.lecture.title}</h3>
                    <p>{result.lecture.description}</p>
                    <VideoPlayer
                        key={result.playbackUrl}
                        src={result.playbackUrl}
                        format={result.format}
                        onError={setError}
                    />
                </>
            )}
        </Page>
    );
}
