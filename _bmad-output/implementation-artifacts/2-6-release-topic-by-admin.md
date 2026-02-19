# Story 2.6: Звільнення теми адміном

Status: review

## Story

As an admin,  
I want to release a student's selected topic back to the available list,  
so that the student can choose a different topic if they made a mistake.

## Acceptance Criteria

1. **Given** тема з `selectedBy !== null`,  
   **When** `POST /admin/topics/:id/release`,  
   **Then** відповідь `200` з `{ topic: { id, title, description, selectedBy: null } }`.
2. **Given** вже вільна тема (`selectedBy: null`),  
   **When** `POST /admin/topics/:id/release`,  
   **Then** відповідь `409` з `{ error: "TOPIC_ALREADY_FREE", message: "Тема вже вільна" }`.
3. **Given** `AdminTopicsPage`,  
   **When** адмін натискає "Звільнити тему" для зайнятої теми,  
   **Then** після підтвердження у модалці виконується запит і таблиця оновлюється.
4. **Given** звільнення теми,  
   **When** операція завершена,  
   **Then** `logAudit(db, { actor: adminId, action: "RELEASE_TOPIC", targetId, ip, result })` викликано.

## Tasks / Subtasks

- [x] Backend release endpoint (AC: 1, 2, 4)
  - [x] Реалізувати `POST /admin/topics/:id/release` (admin only)
  - [x] Повернути `409 TOPIC_ALREADY_FREE` для вільної теми
  - [x] Повернути `200` з topic payload після звільнення
  - [x] Додати audit log `RELEASE_TOPIC`
- [x] Frontend release flow (AC: 3)
  - [x] Додати кнопку `Звільнити тему` для зайнятих тем
  - [x] Додати модалку підтвердження
  - [x] Після confirm оновлювати рядок теми у таблиці
- [x] Tests and validation
  - [x] Backend test на release + already free + not found
  - [x] Frontend render test модалки підтвердження

## Dev Notes

- В in-memory реалізації атомарність моделюється прямим оновленням одного topic-документа.
- Для помилки вільної теми використано точне повідомлення з AC.

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Implemented release endpoint and audit behavior.
- Added UI release confirmation modal and release action.
- Added tests and validated backend/frontend.

### Completion Notes List

- Story implemented and validated; status set to `review`.

### File List

- _bmad-output/implementation-artifacts/2-6-release-topic-by-admin.md
- backend/src/server.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/App.test.tsx
