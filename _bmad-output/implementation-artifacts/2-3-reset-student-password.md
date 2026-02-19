# Story 2.3: Скидання пароля студента

Status: review

## Story

As an admin,  
I want to reset a student's password,  
so that I can help a student who has forgotten their credentials without deleting their account.

## Acceptance Criteria

1. **Given** існуючий студент,  
   **When** `POST /admin/users/:id/reset-password`,  
   **Then** відповідь `200` з `{ newPassword }` — новий пароль повернений один раз, зберігається тільки bcrypt hash.
2. **Given** `AdminStudentsPage`,  
   **When** адмін натискає \"Скинути пароль\" для студента,  
   **Then** новий пароль відображається у модалці один раз з підказкою скопіювати.
3. **Given** скидання пароля,  
   **When** операція завершена,  
   **Then** `logAudit(db, { actor: adminId, action: "RESET_PASSWORD", targetId, ip, result })` викликано — `newPassword` не логується.

## Tasks / Subtasks

- [x] Backend endpoint reset password (AC: 1, 3)
  - [x] Реалізувати `POST /admin/users/:id/reset-password` (admin only)
  - [x] Генерувати новий пароль, повертати один раз у response
  - [x] Оновлювати тільки hash у storage
  - [x] Додавати audit log `RESET_PASSWORD` без plaintext пароля
- [x] Frontend reset flow (AC: 2)
  - [x] Кнопка `Скинути пароль` у таблиці студентів
  - [x] Одноразове відображення нового пароля в модальному блоці
  - [x] Підказка скопіювати пароль
- [x] Tests and validation
  - [x] Backend test для reset-password endpoint
  - [x] Frontend route/render test для reset control та модалки

## Dev Notes

- Поточний проект не використовує повноцінний modal-пакет; для MVP використаний локальний modal-like блок.
- Логування події reset не повинно містити `newPassword`.

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Implemented reset-password backend endpoint and audit behavior.
- Added admin UI reset action and one-time password modal.
- Added/updated tests and validated backend/frontend.

### Completion Notes List

- Story implemented and validated; status set to `review`.

### File List

- _bmad-output/implementation-artifacts/2-3-reset-student-password.md
- backend/src/server.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/App.test.tsx
