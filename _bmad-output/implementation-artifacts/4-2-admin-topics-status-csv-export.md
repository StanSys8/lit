# Story 4.2: CSV export статусу тем

Status: review

## Story

As an admin,  
I want to download a CSV with the current status of all topics,  
so that I can share a progress report with the department.

## Acceptance Criteria

1. **Given** автентифікований адмін,  
   **When** `GET /admin/export/status`,  
   **Then** повертається CSV з колонками `title,description,supervisor,department,studentName,studentEmail,status`.
2. **Given** відповідь export endpoint,  
   **When** перевірено headers,  
   **Then** `Content-Type: text/csv` і `Content-Disposition: attachment; filename="topics-status-<YYYY-MM-DD>.csv"`.
3. **Given** кнопка "Завантажити CSV статусу" на дашборді,  
   **When** натиснута,  
   **Then** браузер ініціює завантаження файлу.
4. **Given** export status operation,  
   **When** виконано endpoint,  
   **Then** `logAudit(... action: "EXPORT_STATUS" ... result: "success")` викликається.

## Tasks / Subtasks

- [x] Backend CSV export endpoint (AC: 1, 2, 4)
  - [x] Реалізовано `GET /admin/export/status` (admin-only)
  - [x] Додано CSV response helper з потрібними headers
  - [x] Додано `EXPORT_STATUS` audit event
- [x] Frontend dashboard action (AC: 3)
  - [x] Додано кнопку `Завантажити CSV статусу`
  - [x] Додано flow скачування blob з `content-disposition` filename
  - [x] Додано стан loading/error для export action
- [x] Tests and validation
  - [x] Backend test для endpoint status/headers/content/audit
  - [x] Frontend render test presence для dashboard export button

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Completion Notes List

- Story implemented and validated; status set to `review`.

### File List

- _bmad-output/implementation-artifacts/4-2-admin-topics-status-csv-export.md
- backend/src/server.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/App.test.tsx
