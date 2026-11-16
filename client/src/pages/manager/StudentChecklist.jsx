import { useAuth } from '../../shared/auth';
import { memberLabel } from '../../shared/memberLabel.mjs';

export default function StudentChecklist({
    label,
    students,
    selectedIds,
    onChange,
    disabled,
    showEmail = false,
}) {
    const { fields, emailEnabled } = useAuth();
    const selected = new Set(selectedIds);
    const checkedCount = students.filter((student) => selected.has(student.id)).length;
    const allChecked = checkedCount === students.length;
    const emailVisible = showEmail && emailEnabled;
    return (
        <fieldset disabled={disabled}>
            <legend>
                {label} ({checkedCount}/{students.length}명 선택)
            </legend>
            {students.length === 0 ? (
                <p>선택할 학생이 없습니다.</p>
            ) : (
                <button
                    type="button"
                    onClick={() =>
                        onChange(allChecked ? [] : students.map((student) => student.id))
                    }
                >
                    {allChecked ? '전체 해제' : '전체 선택'}
                </button>
            )}
            {students.map((student) => {
                const name = memberLabel(student, fields);
                return (
                    <label key={student.id}>
                        <input
                            type="checkbox"
                            checked={selected.has(student.id)}
                            onChange={(event) =>
                                onChange(
                                    event.target.checked
                                        ? [...selectedIds, student.id]
                                        : selectedIds.filter((id) => id !== student.id),
                                )
                            }
                        />{' '}
                        {name}
                        {emailVisible &&
                            student.email &&
                            name !== student.email &&
                            ' · ' + student.email}
                        {student.status === 'suspended' && ' · 정지'}
                        {student.status === 'pending' && ' · 승인 대기'}
                        {student.canManage && ' · 관리자'}
                    </label>
                );
            })}
        </fieldset>
    );
}
