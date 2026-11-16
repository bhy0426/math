import { Link } from 'react-router-dom';
import { api } from '../../shared/api';
import { useAction } from '../../shared/hooks';
import { DeleteButton, Field, Form } from '../../shared/components';

export default function LectureManager({ course, lectures, onChange }) {
    const action = useAction();
    const base = `/courses/${course.id}/lectures`;
    function save(form, element, lecture) {
        return action.run(async () => {
            if (!form.get('video')?.size) form.delete('video');
            form.set('isPublished', String(form.has('isPublished')));
            const result = await api(
                lecture ? 'PATCH' : 'POST',
                base + (lecture ? '/' + lecture.id : ''),
                form,
            );
            if (!lecture) element.reset();
            onChange();
            return result;
        });
    }
    return (
        <section>
            <h3>강의 관리 · {course.title}</h3>
            <p role="status">{action.message}</p>
            <ul>
                {lectures.map((lecture) => (
                    <li key={lecture.id}>
                        <Link to={`${base}/${lecture.id}`}>{lecture.title}</Link>
                        <span>
                            {' '}
                            ·{' '}
                            {
                                {
                                    NO_VIDEO: '영상 없음',
                                    ORIGINAL: '원본 재생',
                                    PROCESSING: '변환 중',
                                    READY: 'HLS 준비 완료',
                                    FAILED: '변환 실패·재시도 가능',
                                }[lecture.videoStatus]
                            }
                        </span>
                        {['ORIGINAL', 'FAILED'].includes(lecture.videoStatus) && (
                            <button
                                disabled={action.busy}
                                onClick={() =>
                                    action.run(async () => {
                                        const result = await api(
                                            'POST',
                                            `${base}/${lecture.id}/convert`,
                                        );
                                        onChange();
                                        return result;
                                    })
                                }
                            >
                                영상 변환·재시도
                            </button>
                        )}
                        <details>
                            <summary>강의 수정</summary>
                            <Form
                                busy={action.busy}
                                onSubmit={(form, element) => save(form, element, lecture)}
                            >
                                <LectureFields lecture={lecture} />
                                <button>수정 저장</button>
                            </Form>
                        </details>
                        <DeleteButton
                            disabled={action.busy}
                            onDelete={() =>
                                action.run(async () => {
                                    const result = await api('DELETE', `${base}/${lecture.id}`);
                                    onChange();
                                    return result;
                                })
                            }
                        />
                    </li>
                ))}
            </ul>
            <h4>강의 업로드</h4>
            <Form busy={action.busy} onSubmit={save}>
                <LectureFields />
                <button>강의 업로드</button>
            </Form>
        </section>
    );
}

function LectureFields({ lecture }) {
    return (
        <>
            <Field
                label="강의명"
                name="title"
                defaultValue={lecture?.title || ''}
                maxLength={160}
                required
            />
            <Field
                label="설명"
                name="description"
                as="textarea"
                defaultValue={lecture?.description || ''}
            />
            <Field
                label="순서"
                name="position"
                type="number"
                min="1"
                defaultValue={lecture?.position || 1}
                required
            />
            <Field
                label={lecture ? '영상 교체' : '영상'}
                name="video"
                type="file"
                accept="video/mp4,video/webm"
                required={!lecture}
            />
            <Field
                label="강의 공개"
                name="isPublished"
                type="checkbox"
                defaultChecked={lecture ? Boolean(lecture.is_published) : true}
            />
        </>
    );
}
