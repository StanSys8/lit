# Story 4.3: Перегляд audit log

Status: review

## Story

As an admin,  
I want to view a complete log of all system actions with actor, IP, and result,  
so that I can detect suspicious activity and verify that operations completed correctly.

## Acceptance Criteria

1. **Given** автентифікований адмін,  
   **When** `GET /admin/audit`,  
   **Then** відповідь `200` з масивом `[{ id, actor, action, targetId, ip, result, createdAt }]` від нових до старих.
2. **Given** `AdminAuditPage`,  
   **When** сторінка завантажена,  
   **Then** таблиця показує: час (ISO -> локальний формат), actor, action, IP, result.
3. **Given** `GET /admin/audit`,  
   **When** виконано read-only запит,  
   **Then** `logAudit` не викликається для цього endpoint.

## Tasks / Subtasks

- [x] Backend audit endpoint (AC: 1, 3)
  - [x] Реалізовано `GET /admin/audit` (admin-only)
  - [x] Додано сортування від нових до старих
  - [x] Немає circular logging для read-only audit endpoint
- [x] Frontend audit section (AC: 2)
  - [x] Додано секцію `Журнал дій` на адмін-сторінці
  - [x] Додано таблицю з колонками: `Час`, `Actor`, `Action`, `IP`, `Result`
  - [x] Додано `loadAudit` fetch flow, loading/error states
- [x] Tests and validation
  - [x] Backend test на shape/sorting/no-self-log
  - [x] Frontend render test presence для audit table headings

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Completion Notes List

- Story implemented and validated; status set to `review`.

### File List

- _bmad-output/implementation-artifacts/4-3-admin-audit-log-view.md
- backend/src/server.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/App.test.tsx
