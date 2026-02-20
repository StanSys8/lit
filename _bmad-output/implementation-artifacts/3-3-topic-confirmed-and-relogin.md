# Story 3.3: Підтвердження вибору та повторний вхід

Status: review

## Story

As a student,  
I want to see confirmation of my selected topic and always see it when I return,  
so that I'm certain my choice was recorded and I know who to contact if I want to change it.

## Acceptance Criteria

1. **Given** успішний вибір теми,  
   **When** студент потрапляє на `TopicConfirmedScreen`,  
   **Then** екран показує checkmark (`#B436F0`), "Тему вибрано!", назву теми, "Якщо потрібна зміна — звернись до вчителя" без кнопок дії.
2. **Given** студент закрив вкладку і повернувся,  
   **When** після логіну відкривається `/topics`,  
   **Then** `POST /auth/login` повертає `{ id, email, role, selectedTopic }`, і при `selectedTopic !== null` одразу рендериться `TopicConfirmedScreen`.
3. **Given** студент з вибраною темою,  
   **When** `GET /topics`,  
   **Then** його тема відсутня в списку (лише `selected_by: null` теми).
4. **Given** студент викликає `POST /topics/:id/release`,  
   **When** запит виконується,  
   **Then** відповідь `404` (endpoint не існує для student).

## Tasks / Subtasks

- [x] Backend selected topic hydration at login (AC: 2)
  - [x] Додано `selectedTopic` у відповідь `POST /auth/login`
  - [x] Додано mapping вибраної теми для студента
- [x] Student UI confirmed state (AC: 1, 2)
  - [x] Додано `TopicConfirmedScreen` і рендер без action buttons
  - [x] Інтегровано в login flow: показ confirmed screen при `selectedTopic !== null`
- [x] API behavior consistency (AC: 3, 4)
  - [x] Перевірено фільтрацію `GET /topics` тільки для вільних тем
  - [x] Перевірено 404 для `POST /topics/:id/release`
- [x] Tests and validation
  - [x] Backend tests: selected topic у login response
  - [x] Backend tests: selected topic excluded from `GET /topics`
  - [x] Backend tests: `/topics/:id/release` returns 404

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Completion Notes List

- Story implemented and validated; status set to `review`.

### File List

- _bmad-output/implementation-artifacts/3-3-topic-confirmed-and-relogin.md
- backend/src/server.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
