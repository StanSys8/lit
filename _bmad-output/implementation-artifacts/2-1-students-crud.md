# Story 2.1: Управління студентами — перегляд, додавання, видалення

Status: review

## Story

As an admin,  
I want to view, add, and delete students individually,  
so that I can manage the student list and ensure each student has access to the system.

## Acceptance Criteria

1. **Given** автентифікований адмін,  
   **When** `GET /admin/users`,  
   **Then** відповідь `200` з масивом `[{ id, name, email, hasSelectedTopic: bool }]`.
2. **Given** валідні дані `{ name, email }`,  
   **When** `POST /admin/users`,  
   **Then** відповідь `201` з `{ id, name, email, newPassword }` — пароль повернений один раз у відповіді, зберігається тільки hash.
3. **Given** `POST /admin/users` з email, що вже існує,  
   **When** запит виконано,  
   **Then** відповідь `409` з `{ error: "EMAIL_ALREADY_EXISTS", message: "Студент з таким email вже існує" }`.
4. **Given** існуючий студент,  
   **When** `DELETE /admin/users/:id`,  
   **Then** відповідь `204 No Content`.
5. **Given** неіснуючий id,  
   **When** `DELETE /admin/users/:id`,  
   **Then** відповідь `404`.
6. **Given** `AdminStudentsPage`,  
   **When** сторінка завантажена,  
   **Then** таблиця відображає ім'я, email, статус вибору теми та кнопки дій.
7. **Given** кожна write-операція (CREATE, DELETE),  
   **When** операція завершена,  
   **Then** `logAudit(db, { actor: adminId, action: "CREATE_USER"|"DELETE_USER", targetId, ip, result })` викликано.

## Tasks / Subtasks

- [x] Backend endpoints for users CRUD (AC: 1, 2, 3, 4, 5, 7)
  - [x] Реалізувати `GET /admin/users` (admin only)
  - [x] Реалізувати `POST /admin/users` (admin only) з генерацією одноразового пароля
  - [x] Реалізувати `DELETE /admin/users/:id` (admin only)
  - [x] Валідація `name/email` + перевірка унікальності email (`409`)
  - [x] Зберігати пароль лише як hash
  - [x] Додати audit log для CREATE/DELETE
- [x] Frontend `AdminStudentsPage` (AC: 6)
  - [x] Таблиця студентів (`name`, `email`, `hasSelectedTopic`)
  - [x] Форма додавання студента (`name`, `email`)
  - [x] Кнопка видалення студента з підтвердженням
  - [x] Обробка помилок (`409`, `404`, `403`, `401`)
- [x] Tests and validation (AC: 1-7)
  - [x] Backend тести для всіх 3 endpoints + edge cases
  - [x] Frontend тести рендера таблиці та базових дій add/delete

## Dev Notes

- Поточний backend використовує in-memory store для MVP; для цієї story зберігаємо той самий підхід.
- Доступ лише для admin через `requireRole('admin')`.
- Формат помилок тримаємо консистентним з попередніми story.
- `newPassword` повертаємо тільки в response `POST /admin/users`; у store тільки hash.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.1: Управління студентами — перегляд, додавання, видалення`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#API & Communication`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#Authentication & Security`]

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Story generated from Epic 2 Story 2.1.
- Story 1.2 remains intentionally deferred by user.
- Backend: implemented `GET /admin/users`, `POST /admin/users`, `DELETE /admin/users/:id` in `backend/src/server.mjs`.
- Backend: added CRUD test coverage and role/auth guards in `backend/src/auth.test.mjs`.
- Frontend: implemented admin students table/add/delete UI in `frontend/src/App.tsx`.
- Frontend: added helper-based tests for add/remove actions in `frontend/src/adminStudents.test.ts`.
- Verification: `cd backend && npm test` and `cd frontend && npm run test` pass.

### Completion Notes List

- Implemented admin students CRUD API with audit logging.
- Implemented admin students page with create/delete actions and error handling.
- Added backend and frontend tests; all tests passing.
- Story moved to `review`.

### File List

- _bmad-output/implementation-artifacts/2-1-students-crud.md
- backend/src/server.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/App.test.tsx
- frontend/src/adminStudents.ts
- frontend/src/adminStudents.test.ts
