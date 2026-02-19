# Story 2.5: Bulk upload тем з CSV

Status: review

## Story

As an admin,  
I want to upload a CSV file with multiple topics at once,  
so that I can quickly populate the topic list without adding each topic manually.

## Acceptance Criteria

1. **Given** CSV файл з колонками `title,description,supervisor,department`,  
   **When** адмін обирає файл,  
   **Then** Papa Parse парсить client-side і показує preview перших 3 рядків.
2. **Given** підтверджений CSV payload,  
   **When** `POST /admin/topics/bulk` з JSON масивом `[{ title, description, supervisor, department }]`,  
   **Then** відповідь `200` з `{ created: N, errors: [{ row, message }] }`.
3. **Given** рядок без `title` або `supervisor`,  
   **When** обробка рядка,  
   **Then** рядок пропускається з описом у `errors`, решта створюються.
4. **Given** bulk upload тем,  
   **When** операція завершена,  
   **Then** `logAudit(db, { actor: adminId, action: "BULK_CREATE_TOPICS", count: N, ip, result })` викликано.

## Tasks / Subtasks

- [x] Backend bulk endpoint for topics (AC: 2, 3, 4)
  - [x] Реалізувати `POST /admin/topics/bulk` (admin only)
  - [x] Пропускати невалідні рядки без `title` або `supervisor`
  - [x] Повернути `{ created, errors }` з row-level помилками
  - [x] Логувати `BULK_CREATE_TOPICS` з count/result
- [x] Frontend CSV flow for topics (AC: 1, 2, 3)
  - [x] Додати parser `parseTopicsCsv` на Papa Parse
  - [x] Додати file input + preview 3 рядків у секцію Topics
  - [x] Додати upload action і відображення `created/errors`
- [x] Tests and validation
  - [x] Backend test для `POST /admin/topics/bulk`
  - [x] Frontend unit tests для `parseTopicsCsv`
  - [x] Frontend render test coverage для topics bulk controls

## Dev Notes

- Для bulk тем required-поля: `title`, `supervisor`; `description` і `department` допускають порожні значення.
- Формат row index у помилках відповідає порядку в payload (1-based).

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Implemented backend `/admin/topics/bulk` with partial success behavior.
- Added topics CSV parser and admin UI for preview/upload.
- Added tests and validated project.

### Completion Notes List

- Story implemented and validated; status set to `review`.

### File List

- _bmad-output/implementation-artifacts/2-5-bulk-upload-topics-csv.md
- backend/src/server.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
- frontend/src/App.test.tsx
- frontend/src/topicsCsv.ts
- frontend/src/topicsCsv.test.ts
