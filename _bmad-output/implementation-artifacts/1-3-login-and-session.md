# Story 1.3: Вхід в систему та збереження сесії

Status: review

## Story

As a student or admin,  
I want to log in with my email and password,  
so that I can access my role-specific area and remain authenticated across page navigations.

## Acceptance Criteria

1. **Given** валідні credentials студента,  
   **When** `POST /auth/login`,  
   **Then** відповідь `200` з body `{ id, email, role: "student" }` і встановлений cookie `httpOnly; Secure; SameSite=None; MaxAge=86400`.
2. **Given** валідні credentials адміна,  
   **When** `POST /auth/login`,  
   **Then** відповідь `200` з body `{ id, email, role: "admin" }` і cookie встановлений.
3. **Given** невірний пароль АБО невідомий email,  
   **When** `POST /auth/login`,  
   **Then** відповідь `401` з `{ error: "INVALID_CREDENTIALS", message: "Невірний email або пароль" }` — однакова відповідь для обох випадків.
4. **Given** невідомий email,  
   **When** `POST /auth/login`,  
   **Then** `bcrypt.compare(password, DUMMY_HASH)` виконується (захист від timing attack).
5. **Given** 5 невдалих спроб підряд для одного email,  
   **When** 6-та спроба,  
   **Then** відповідь `423` з `{ error: "ACCOUNT_LOCKED", lockedUntil: <ISO timestamp +15хв> }`.
6. **Given** валідний JWT cookie,  
   **When** `GET /topics` (студент) або `GET /admin/topics` (адмін),  
   **Then** відповідь `200`.
7. **Given** студентський cookie,  
   **When** `GET /admin/topics`,  
   **Then** відповідь `403 Forbidden`.
8. **Given** відсутній або прострочений cookie,  
   **When** будь-який захищений маршрут,  
   **Then** відповідь `401 Unauthorized`.
9. **Given** логін (успішний або невдалий),  
   **When** операція завершена,  
   **Then** `logAudit(db, { actor: email, action: "LOGIN", ip, result: "success"|"failed"|"locked" })` викликано.
10. **Given** `LoginPage`,  
    **When** успішний вхід студента,  
    **Then** редірект на `/topics`.
11. **Given** `LoginPage`,  
    **When** успішний вхід адміна,  
    **Then** редірект на `/admin`.
12. **Given** помилка логіну,  
    **When** відповідь від API,  
    **Then** повідомлення відображається inline під формою, без перезавантаження сторінки.

## Tasks / Subtasks

- [x] Backend auth endpoint `POST /auth/login` (AC: 1, 2, 3, 4, 5, 9)
  - [x] Реалізувати перевірку користувача по email + bcrypt compare
  - [x] Додати `DUMMY_HASH` compare для невідомого email
  - [x] Додати lockout policy: 5 fail -> 15 хв lock
  - [x] Ставити JWT cookie (`httpOnly`, `Secure`, `SameSite=None`, `MaxAge=86400`)
  - [x] Логувати login attempts через `logAudit`
- [x] Middleware доступу до захищених маршрутів (AC: 6, 7, 8)
  - [x] `requireAuth` для перевірки/декоду JWT cookie
  - [x] `requireRole('admin')` для `/admin/*`
  - [x] Повернення 401/403 у стандартизованому форматі
- [x] Frontend login flow (AC: 10, 11, 12)
  - [x] Форма логіну з inline-помилкою
  - [x] Виклик API login з `credentials: 'include'`
  - [x] Редірект по ролі: student -> `/topics`, admin -> `/admin`
- [x] Тести і валідації (AC: 1-12)
  - [x] Backend unit/integration тести для login/lockout/authz
  - [x] Frontend тести для success/error редіректів

## Dev Notes

- Дотримуватись архітектурних обмежень:
  - `bcryptjs` (не `bcrypt`)
  - JWT у cookie, не `localStorage`
  - `SameSite=None; Secure` через cross-origin frontend/API
  - централізовані `requireAuth` / `requireRole`
- Для CORS дозволяти тільки точний фронтенд origin.
- Поведінка помилок повинна бути консистентна з `Error Response Standard`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.3: Вхід в систему та збереження сесії`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#Authentication & Security`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#API & Communication`]

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Story generated from Epic 1 Story 1.3.
- Story 1.2 deliberately deferred by user; work continued on next implementation story.
- Backend implemented in `backend/src/server.mjs` with `/auth/login`, `/topics`, `/admin/topics`, cookie auth, role guards, lockout, audit logging.
- Security helper added in `backend/src/security.mjs` (`bcryptCompare`, token sign/verify).
- Backend tests added: `backend/src/auth.test.mjs` and passing via `npm test`.
- Frontend login flow implemented in `frontend/src/App.tsx` with inline errors and role redirects.
- Frontend build passes via `npm run build`; Vite prints Node version warning in this environment but build succeeds.
- Frontend tests configured and passing via `vitest run`.

### Completion Notes List

- Completed backend auth endpoint, middleware guards, and frontend login flow.
- Verified backend behavior with automated tests and frontend type/build checks.
- Story moved to `review` after frontend automated tests were added and passing.

### File List

- _bmad-output/implementation-artifacts/1-3-login-and-session.md
- backend/package.json
- backend/src/index.mjs
- backend/src/server.mjs
- backend/src/security.mjs
- backend/src/cookies.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/App.test.tsx
- frontend/vitest.config.ts
- frontend/src/test/setup.ts
- frontend/package.json
- frontend/vite.config.ts
