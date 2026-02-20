# Story 4.4: CSV export audit log

Status: review

## Story

As an admin,  
I want to download the full audit log as a CSV,  
so that I can archive activity records or investigate incidents outside the system.

## Acceptance Criteria

1. **Given** автентифікований адмін,  
   **When** `GET /admin/export/audit`,  
   **Then** повертається CSV з колонками `createdAt,actor,action,targetId,ip,result`.
2. **Given** відповідь export endpoint,  
   **When** перевірено headers,  
   **Then** `Content-Type: text/csv` і `Content-Disposition: attachment; filename="audit-log-<YYYY-MM-DD>.csv"`.
3. **Given** кнопка "Завантажити CSV аудиту" на `AdminAuditPage`,  
   **When** натиснута,  
   **Then** браузер ініціює завантаження файлу.
4. **Given** export audit operation,  
   **When** endpoint виконано,  
   **Then** `EXPORT_AUDIT` записується в audit log з `result: "success"`.

## Tasks / Subtasks

- [x] Backend CSV export endpoint (AC: 1, 2, 4)
  - [x] Реалізовано `GET /admin/export/audit` (admin-only)
  - [x] Додано CSV payload з потрібними колонками
  - [x] Додано headers `Content-Type` і `Content-Disposition`
  - [x] Додано `EXPORT_AUDIT` audit event
- [x] Frontend audit export action (AC: 3)
  - [x] Додано кнопку `Завантажити CSV аудиту` в секції `Журнал дій`
  - [x] Додано blob download flow з іменем файлу із response headers
  - [x] Додано loading/error стани
- [x] Tests and validation
  - [x] Backend test: endpoint status/headers/content/audit
  - [x] Frontend render test: presence export-audit button

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Completion Notes List

- Story implemented and validated; status set to `review`.

### File List

- _bmad-output/implementation-artifacts/4-4-admin-audit-log-csv-export.md
- backend/src/server.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
- frontend/src/App.test.tsx
