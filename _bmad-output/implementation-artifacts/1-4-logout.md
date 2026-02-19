# Story 1.4: Вихід із системи

Status: review

## Story

As a logged-in user,  
I want to log out,  
so that my session is cleared and no one else can use my account on this device.

## Acceptance Criteria

1. **Given** автентифікований користувач,  
   **When** `POST /auth/logout`,  
   **Then** відповідь `200` і cookie очищений (`Set-Cookie` з `maxAge=0`).
2. **Given** очищений cookie,  
   **When** будь-який захищений маршрут,  
   **Then** відповідь `401 Unauthorized`.
3. **Given** кнопка виходу в UI (студент: header; адмін: sidebar),  
   **When** натиснута,  
   **Then** `POST /auth/logout` виконано і редірект на `/login`.
4. **Given** вихід із системи,  
   **When** операція завершена,  
   **Then** `logAudit(db, { actor: userId, action: "LOGOUT", ip, result: "success" })` викликано.

## Tasks / Subtasks

- [x] Backend logout endpoint (AC: 1, 2, 4)
  - [x] Реалізувати `POST /auth/logout` тільки для автентифікованого користувача
  - [x] Очищати session cookie (`Max-Age=0`, `HttpOnly`, `Secure`, `SameSite=None`)
  - [x] Логувати `LOGOUT` через audit (`actor = userId`)
  - [x] Додати тест: logout + unauthorized після очищеного cookie
- [x] Frontend logout flow (AC: 3)
  - [x] Додати кнопку Logout для student у `header`
  - [x] Додати кнопку Logout для admin у `sidebar`
  - [x] Викликати `POST /auth/logout` і редіректити на `/login`

## Dev Notes

- Logout endpoint використовує ту ж cookie-політику, що і login.
- `POST /auth/logout` повертає `401`, якщо cookie відсутня/невалідна.
- Для UI дотримано вимогу розміщення кнопки:
  - Student area: `header`
  - Admin area: `aside` (sidebar)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.4: Вихід із системи`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#Authentication & Security`]

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Implemented backend logout handler with auth requirement and audit logging.
- Added logout integration test in backend auth test suite.
- Updated frontend routed views to include logout controls and API call.

### Completion Notes List

- Story implemented and validated with backend automated tests and frontend build/test checks.

### File List

- _bmad-output/implementation-artifacts/1-4-logout.md
- backend/src/server.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/App.test.tsx
