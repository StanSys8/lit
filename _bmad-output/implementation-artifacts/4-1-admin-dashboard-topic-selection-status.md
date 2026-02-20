# Story 4.1: Дашборд статусу розподілу тем

Status: review

## Story

As an admin,  
I want to see a real-time overview of topic selection progress,  
so that I can monitor how many students have chosen their topics at a glance.

## Acceptance Criteria

1. **Given** `AdminDashboardPage`,  
   **When** сторінка завантажується,  
   **Then** `AdminStatCard` відображає `X / Y студентів вибрали тему`.
2. **Given** дані з `GET /admin/users` і `GET /admin/topics`,  
   **When** дашборд рендериться,  
   **Then** прогрес-блок відображає X/Y без додаткового API call.
3. **Given** другий `AdminStatCard`,  
   **When** дашборд завантажено,  
   **Then** відображає `Z вільних тем з N загалом`.
4. **Given** 0 студентів вибрали тему,  
   **When** дашборд відкрито,  
   **Then** прогрес `0 / Y` відображається коректно.
5. **Given** всі студенти вибрали теми,  
   **When** дашборд відкрито,  
   **Then** card рендериться з primary-варіантом (`border-[#B436F0]`).

## Tasks / Subtasks

- [x] Dashboard stats UI (AC: 1, 3, 4, 5)
  - [x] Додано компонент `AdminStatCard`
  - [x] Додано два статистичні блоки: student progress + free topics
  - [x] Додано primary/warning variants для card
- [x] Computed metrics from existing state (AC: 2)
  - [x] Розрахунок X/Y студентів із `students` state
  - [x] Розрахунок Z/N тем із `topics` state
  - [x] Без додаткових API викликів
- [x] Tests and validation
  - [x] Оновлено route render test для `/admin`
  - [x] Додано компонентний тест `AdminStatCard` (primary variant)

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Completion Notes List

- Story implemented and validated; status set to `review`.

### File List

- _bmad-output/implementation-artifacts/4-1-admin-dashboard-topic-selection-status.md
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/App.test.tsx
