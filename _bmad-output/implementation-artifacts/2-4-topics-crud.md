# Story 2.4: Управління темами — перегляд, додавання, видалення

Status: review

## Story

As an admin,  
I want to view, add, and delete thesis topics,  
so that I can maintain the list of topics available for students to choose from.

## Acceptance Criteria

1. **Given** автентифікований адмін,  
   **When** `GET /admin/topics`,  
   **Then** відповідь `200` з масивом `[{ id, title, description, supervisor, department, selectedBy: { id, name } | null }]`.
2. **Given** валідні дані `{ title, description, supervisor, department }`,  
   **When** `POST /admin/topics`,  
   **Then** відповідь `201` з `{ id, title, description, supervisor, department, selectedBy: null }`.
3. **Given** тема з `selectedBy !== null`,  
   **When** `DELETE /admin/topics/:id`,  
   **Then** відповідь `409` з `{ error: "TOPIC_IN_USE", message: "Тема вже вибрана студентом — спочатку звільніть її" }`.
4. **Given** вільна тема,  
   **When** `DELETE /admin/topics/:id`,  
   **Then** відповідь `204 No Content`.
5. **Given** `AdminTopicsPage`,  
   **When** сторінка завантажена,  
   **Then** таблиця відображає назву, опис, ім'я студента (або "вільна") та кнопки дій.
6. **Given** кожна write-операція (CREATE, DELETE),  
   **When** операція завершена,  
   **Then** `logAudit(db, { actor: adminId, action: "CREATE_TOPIC"|"DELETE_TOPIC", targetId, ip, result })` викликано.

## Tasks / Subtasks

- [x] Backend topics CRUD API (AC: 1, 2, 3, 4, 6)
  - [x] Реалізувати `GET /admin/topics` з `selectedBy` details
  - [x] Реалізувати `POST /admin/topics` з валідацією required полів
  - [x] Реалізувати `DELETE /admin/topics/:id` з `409 TOPIC_IN_USE` для зайнятих тем
  - [x] Додати audit log для `CREATE_TOPIC` і `DELETE_TOPIC`
- [x] Frontend admin topics UI (AC: 5)
  - [x] Додати секцію `Topics` на `/admin` з таблицею тем
  - [x] Додати форму створення теми
  - [x] Додати видалення теми з обробкою `TOPIC_IN_USE`
- [x] Tests and validation
  - [x] Backend integration test для topics CRUD
  - [x] Frontend render test для topics controls/headers

## Dev Notes

- Для демо-даних додано одну вільну і одну зайняту тему, щоб покрити сценарій `TOPIC_IN_USE`.
- Повідомлення `409` реалізовано у точній формі з AC.

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Implemented backend topics CRUD routes and audit logging.
- Added admin topics CRUD section in frontend dashboard.
- Added tests and validated backend/frontend.

### Completion Notes List

- Story implemented and validated; status set to `review`.

### File List

- _bmad-output/implementation-artifacts/2-4-topics-crud.md
- backend/src/server.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/App.test.tsx
