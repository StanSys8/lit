# Story 2.2: Bulk upload студентів та export credentials

Status: review

## Story

As an admin,  
I want to upload a CSV with multiple students and immediately download their credentials,  
so that I can quickly populate the system and send login details to all students at once.

## Acceptance Criteria

1. **Given** CSV файл з колонками `name,email`,  
   **When** адмін обирає файл (drag & drop або file picker),  
   **Then** Papa Parse парсить client-side і показує preview перших 3 рядків перед відправкою.
2. **Given** підтверджений CSV payload,  
   **When** `POST /admin/users/bulk` з JSON масивом `[{ name, email }]`,  
   **Then** відповідь `200` з `{ created: N, users: [{ name, email, password }], errors: [{ row, message }] }`.
3. **Given** дублікати email в CSV або у БД,  
   **When** обробка рядка,  
   **Then** рядок пропускається з описом у `errors`, решта створюються.
4. **Given** успішна відповідь від `POST /admin/users/bulk`,  
   **When** `users` масив не порожній,  
   **Then** UI показує кнопку "Завантажити CSV з паролями" — CSV генерується client-side з даних відповіді (Papa Parse unparse).
5. **Given** завантажений CSV credentials,  
   **When** відкрити файл,  
   **Then** містить колонки `name,email,password` для всіх успішно створених студентів.
6. **Given** bulk upload (успішний або частковий),  
   **When** операція завершена,  
   **Then** `logAudit(db, { actor: adminId, action: "BULK_CREATE_USERS", count: N, ip, result })` викликано.

## Tasks / Subtasks

- [x] Backend bulk endpoint (AC: 2, 3, 6)
  - [x] Реалізувати `POST /admin/users/bulk` (admin only)
  - [x] Обробляти дублі в CSV та БД з детальними `errors`
  - [x] Повертати `users: [{ name, email, password }]` тільки для створених
  - [x] Логувати `BULK_CREATE_USERS` (count/result)
- [x] Frontend CSV flow (AC: 1, 4, 5)
  - [x] File picker + Papa Parse client-side
  - [x] Preview перших 3 рядків перед submit
  - [x] Відправка JSON payload на `/admin/users/bulk`
  - [x] Кнопка download credentials CSV через Papa.unparse
- [x] Tests and validation
  - [x] Backend tests for bulk endpoint
  - [x] Frontend tests for helper logic and route render

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Story generated from Epic 2 Story 2.2.
- Backend: implemented `POST /admin/users/bulk` in `backend/src/server.mjs`.
- Backend: added bulk endpoint test coverage in `backend/src/auth.test.mjs`.
- Frontend: implemented file picker, CSV preview, bulk upload, and credentials download UI in `frontend/src/App.tsx`.
- Frontend: added CSV helper tests in `frontend/src/studentsCsv.test.ts` and switched helpers to `Papa.parse`/`Papa.unparse`.
- Verification: `cd backend && npm test`, `cd frontend && npm run test`, `cd frontend && npm run build`.

### Completion Notes List

- Functional bulk flow implemented and tested with Papa Parse.
- Story moved to `review`.

### File List

- _bmad-output/implementation-artifacts/2-2-bulk-upload-and-credentials-export.md
- backend/src/server.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/App.test.tsx
- frontend/src/studentsCsv.ts
- frontend/src/studentsCsv.test.ts
- frontend/package.json
