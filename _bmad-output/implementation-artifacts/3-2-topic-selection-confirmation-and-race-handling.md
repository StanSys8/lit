# Story 3.2: Вибір теми з підтвердженням та race condition handling

Status: review

## Story

As a student,  
I want to select a topic with a confirmation step and receive clear feedback on success or failure,  
so that I know exactly whether my selection was recorded or if I need to choose another topic.

## Acceptance Criteria

1. `TopicConfirmDialog` відкривається з текстом підтвердження вибору.
2. Overlay click не закриває діалог.
3. Фокус при відкритті встановлюється на кнопку "Назад до списку".
4. Під час confirm кнопка стає disabled і показує loading state.
5. Успіх `POST /topics/:id/select` переводить студента в confirmed state.
6. `409 TOPIC_ALREADY_TAKEN` показує `RaceConditionAlert`.
7. `RaceConditionAlert` автозникає через 8 секунд.
8. `409 ALREADY_SELECTED` повертається для повторного вибору.
9. Після success/409 список тем оновлюється.
10. Кожна спроба вибору теми логиться як `SELECT_TOPIC` (`success|denied`).

## Tasks / Subtasks

- [x] Backend select endpoint (AC: 5, 6, 8, 10)
  - [x] Реалізовано `POST /topics/:id/select`
  - [x] Додано `TOPIC_ALREADY_TAKEN`, `ALREADY_SELECTED`, `NOT_FOUND`
  - [x] Додано `SELECT_TOPIC` audit log
- [x] Frontend confirmation flow (AC: 1, 2, 3, 4, 5, 6, 7, 9)
  - [x] Додано `TopicConfirmDialog`
  - [x] Додано race alert з auto-dismiss 8s
  - [x] Додано loading/disabled state на confirm button
  - [x] Додано refresh списку після success/conflict
  - [x] Додано confirmed state екран після успішного вибору
- [x] Tests and validation
  - [x] Backend tests для select success/conflicts/audit
  - [x] Frontend render tests для нових компонентів

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Completion Notes List

- Story implemented and validated; status set to `review`.

### File List

- _bmad-output/implementation-artifacts/3-2-topic-selection-confirmation-and-race-handling.md
- backend/src/server.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/App.test.tsx
