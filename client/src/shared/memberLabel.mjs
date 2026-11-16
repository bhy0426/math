export function memberLabel(user, fields) {
    for (const key of ['nickname', 'username', 'email']) {
        if (fields?.some((field) => field.key === key && field.enabled) && user[key])
            return user[key];
    }
    return `회원 번호 ${user.id}`;
}
