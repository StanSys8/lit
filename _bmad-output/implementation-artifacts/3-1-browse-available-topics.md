# Story 3.1: Перегляд списку вільних тем

Status: review

## Story

As a student,  
I want to browse available thesis topics with their descriptions,  
so that I can make an informed decision about which topic suits me before committing.

## Acceptance Criteria

1. **Given** автентифікований студент,  
   **When** `GET /topics`,  
   **Then** відповідь `200` з масивом `[{ id, title, description, supervisor, department }]` тільки для вільних тем.
2. **Given** `TopicsPage`,  
   **When** сторінка завантажується,  
   **Then** відображаються skeleton-рядки (4 шт.) до отримання відповіді.
3. **Given** список тем завантажено,  
   **When** студент натискає на назву теми,  
   **Then** `TopicAccordionItem` розкривається in-place з описом, керівником, кафедрою і кнопкою `Вибрати цю тему` з візуальним акцентом `border-l-4 border-[#B436F0]`.
4. **Given** пошуковий рядок (debounce 300ms),  
   **When** студент вводить текст,  
   **Then** список фільтрується client-side за назвою.
5. **Given** пошук без збігів,  
   **When** жодна тема не відповідає запиту,  
   **Then** відображається `Нічого не знайдено за запитом «[query]»`.
6. **Given** всі теми вже вибрані,  
   **When** список завантажено,  
   **Then** відображається `Всі теми вже вибрані. Зверніться до вчителя.`
7. **Given** мобільний пристрій (375px),  
   **When** сторінка відкрита,  
   **Then** touch targets accordion item мають мінімум 44px висоти й 16px горизонтального padding.

## Tasks / Subtasks

- [x] Backend topics list for student (AC: 1)
  - [x] Оновити `GET /topics` для повернення тільки вільних тем у student-форматі
  - [x] Розширити backend test перевіркою структури відповіді
- [x] Student Topics UI (AC: 2, 3, 6, 7)
  - [x] Реалізувати `TopicsPage` секцію на маршруті `/topics`
  - [x] Додати skeleton state під час завантаження
  - [x] Додати `TopicAccordionItem` з розкриттям in-place
  - [x] Додати стиль кнопки вибору теми з потрібним border акцентом
  - [x] Додати empty state для порожнього списку тем
- [x] Search UX (AC: 4, 5)
  - [x] Додати пошук за назвою з debounce 300ms
  - [x] Додати повідомлення для no-results
- [x] Tests and validation
  - [x] Оновити frontend render tests для `/topics`
  - [x] Додати тест рендеру `TopicAccordionItem`

## Dev Notes

- Поточний потік реалізує лише перегляд тем; submit вибору теми буде реалізований у Story 3.2.

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Implemented student topics API and UI browse flow.
- Added debounce search and empty/no-results states.
- Added tests and validated backend/frontend.

### Completion Notes List

- Story implemented and validated; status set to `review`.

### File List

- _bmad-output/implementation-artifacts/3-1-browse-available-topics.md
- backend/src/server.mjs
- backend/src/auth.test.mjs
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/App.test.tsx
