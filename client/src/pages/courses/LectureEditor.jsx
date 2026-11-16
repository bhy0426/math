import { api } from '../../shared/api';
import { DeleteButton, Field, Form } from '../../shared/components';
import { useAction } from '../../shared/hooks';

const videoStatusText = {
    NO_VIDEO: '영상 없음',
    ORIGINAL: '원본 재생',
    PROCESSING: '변환 중',
    READY: 'HLS 준비 완료',
    FAILED: '변환 실패',
};

export default function LectureEditor({ courseId, lecture, onChange }) {
    const action = useAction();
    const base = `/courses/${courseId}/lectures`;
    const path = lecture ? `${base}/${lecture.id}` : base;

    function save(form, element) {
        return action.run(async () => {
            if (!form.get('video')?.size) form.delete('video');
            form.set('isPublished', String(form.has('isPublished')));
            const result = await api(lecture ? 'PATCH' : 'POST', path, form);
            if (lecture) element.elements.video.value = '';
            else element.reset();
            onChange();
            return result;
        });
    }

    function remove() {
        return action.run(async () => {
            const result = await api('DELETE', path);
            onChange();
            return result;
        });
    }

    function convert() {
        return action.run(async () => {
            const result = await api('POST', path + '/convert');
            onChange();
            return result;
        });
    }

    return (
        <details>
            <summary>{lecture ? '영상 수정' : '영상 추가'}</summary>
            {lecture && (
                <p>
                    {videoStatusText[lecture.videoStatus]} ·{' '}
                    {lecture.is_published ? '공개' : '비공개'}
                    {['ORIGINAL', 'FAILED'].includes(lecture.videoStatus) && (
                        <button type="button" disabled={action.busy} onClick={convert}>
                            영상 변환·재시도
                        </button>
                    )}
                </p>
            )}
            <Form busy={action.busy} onSubmit={save}>
                <Field
                    label="강의명"
                    name="title"
                    defaultValue={lecture?.title}
                    maxLength={160}
                    required
                />
                <Field
                    label="설명"
                    name="description"
                    as="textarea"
                    defaultValue={lecture?.description}
                    maxLength={10000}
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
                    label={lecture ? '영상 교체' : '영상 파일'}
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
                <button>{lecture ? '수정 저장' : '영상 업로드'}</button>
                {lecture && <DeleteButton onDelete={remove}>강의 삭제</DeleteButton>}
            </Form>
            {action.message && <p role="status">{action.message}</p>}
        </details>
    );
}
