---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
status: complete
documentsInventory:
  prd: _bmad-output/planning-artifacts/prd.md
  architecture: _bmad-output/planning-artifacts/architecture.md
  epics: _bmad-output/planning-artifacts/epics.md
  ux: _bmad-output/planning-artifacts/ux-design-specification.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-02-19
**Project:** lit

## Document Inventory

| Тип | Файл | Розмір | Дата |
|-----|------|--------|------|
| PRD | `prd.md` | 14,985 bytes | Feb 18 19:57 |
| Architecture | `architecture.md` | 30,635 bytes | Feb 19 19:15 |
| Epics & Stories | `epics.md` | 39,519 bytes | Feb 19 19:56 |
| UX Design | `ux-design-specification.md` | 29,402 bytes | Feb 18 16:44 |

**Статус Discovery:** ✅ Всі 4 ключові документи знайдені, дублікатів немає.

---

## PRD Analysis

### Functional Requirements

FR1: Учень може увійти в систему за email і паролем
FR2: Адмін може увійти в систему за email і паролем
FR3: Система розрізняє ролі `student` і `admin` та обмежує доступ відповідно
FR4: Автентифікована сесія зберігається між переходами сторінок
FR5: Користувач може вийти з системи
FR6: Адмін може скинути пароль учня (генерує новий, доступний через CSV export)
FR7: Учень може переглядати список тільки вільних тем
FR8: Учень може переглянути назву та опис будь-якої вільної теми до вибору
FR9: Учень може вибрати одну тему зі списку
FR10: Система гарантує що одну тему може вибрати рівно один учень
FR11: При спробі вибрати вже зайняту тему учень отримує явне повідомлення про відмову
FR12: Після вибору учень бачить підтвердження з назвою та описом своєї теми
FR13: Учень не може вибрати більше однієї теми
FR14: Учень не може самостійно скасувати вибір теми
FR15: При повторному вході учень бачить свою тему з повідомленням що зміна тільки через адміна
FR16: Адмін може додати учня (ім'я, email)
FR17: Адмін може видалити учня
FR18: Адмін може завантажити список учнів з CSV-файлу (bulk upload)
FR19: Система генерує пароль для кожного нового учня
FR20: Адмін може вивантажити CSV з credentials учнів для ручної відправки
FR21: Адмін може додати тему (назва, опис)
FR22: Адмін може видалити тему
FR23: Адмін може завантажити список тем з CSV-файлу (bulk upload)
FR24: Адмін може звільнити тему (повернути у список вільних)
FR25: Адмін може переглядати поточний статус всіх тем (вільна / зайнята + ким)
FR26: Адмін може вивантажити поточний статус у форматі CSV
FR27: Адмін може переглядати audit log дій у системі
FR28: Адмін може вивантажити audit log у форматі CSV
FR29: Система логує кожен вхід (actor, timestamp, IP, result)
FR30: Система логує кожну спробу вибору теми (actor, тема, timestamp, IP, result: success/denied)
FR31: Система логує всі адмін-операції (тип операції, timestamp, IP)

**Всього FR: 31**

### Non-Functional Requirements

NFR1: API відповідає на запити читання за ≤2с при нормальному навантаженні
NFR2: Операція вибору теми завершується за ≤3с включно з lock-механізмом
NFR3: Lambda cold start ≤5с — прийнятно для внутрішнього інструменту з низьким трафіком
NFR4: Система витримує одночасну роботу ~90 учнів без деградації
NFR5: Паролі зберігаються виключно у вигляді bcrypt hash (min cost factor 10)
NFR6: JWT в httpOnly, Secure, SameSite=None cookie; термін дії ≤24h (захист від CSRF через вузький CORS allow-origin)
NFR7: Всі комунікації клієнт↔API по HTTPS
NFR8: API Gateway throttling: ≤10 req/хв на auth endpoint з одного IP
NFR9: Після N невдалих спроб логіну акаунт тимчасово блокується (N і тривалість TBD в архітектурі)
NFR10: MongoDB Atlas M0 — доступ виключно через connection string в Lambda env vars; мережевий доступ `0.0.0.0/0` з обов'язковою TLS-аутентифікацією
NFR11: Операція вибору теми або завершується успіхом, або повертає явну помилку — silent failure неприпустимий
NFR12: При збої write-операції дані залишаються консистентними (no partial writes)
NFR13: CSV export доступний завжди незалежно від стану ongoing selections
NFR14: Щомісячні витрати AWS ≤$0 (Free Tier: Lambda 1M req, API Gateway 1M req, S3 5GB)
NFR15: Cloudflare Free tier — без платних features

**Всього NFR: 15**

### Additional Requirements / Constraints

- **Масштаб:** ~90 учнів, ~120 тем курсових робіт
- **Дедлайн:** 7 днів (MVP)
- **Тип проєкту:** Greenfield, Web Application (SPA + REST API)
- **Стек:** React + Vite → Cloudflare Pages / Node.js Lambda + API Gateway HTTP API / MongoDB Atlas M0 / Terraform
- **Бюджет:** $0/міс (AWS Free Tier + Cloudflare Free)
- **⚠️ Незавершено в PRD:** NFR9 — кількість спроб N та тривалість блокування помічені як "TBD в архітектурі" — потребує перевірки в architecture.md

### PRD Completeness Assessment

PRD є добре структурованим і деталізованим. 31 FR охоплює всі основні user journey. 15 NFR включають Performance, Security, Reliability та Cost. Виявлено одну незакриту деталь у NFR9 (N і тривалість — TBD). Решта вимог чіткі та вимірювані.

---

## Epic Coverage Validation

### Coverage Matrix

| FR | PRD Requirement (скорочено) | Epic Coverage | Статус |
|----|----------------------------|---------------|--------|
| FR1 | Вхід учня email/пароль | Epic 1 → Story 1.3 | ✅ Covered |
| FR2 | Вхід адміна email/пароль | Epic 1 → Story 1.3 | ✅ Covered |
| FR3 | Ролі student/admin, обмеження доступу | Epic 1 → Story 1.3 | ✅ Covered |
| FR4 | Сесія між переходами сторінок | Epic 1 → Story 1.3 | ✅ Covered |
| FR5 | Вихід із системи | Epic 1 → Story 1.4 | ✅ Covered |
| FR6 | Адмін скидає пароль учня | Epic 2 → Story 2.3 | ✅ Covered |
| FR7 | Список тільки вільних тем | Epic 3 → Story 3.1 | ✅ Covered |
| FR8 | Перегляд назви та опису теми | Epic 3 → Story 3.1 | ✅ Covered |
| FR9 | Вибір однієї теми | Epic 3 → Story 3.2 | ✅ Covered |
| FR10 | Атомарний вибір (нуль дублів) | Epic 3 → Story 3.2 | ✅ Covered |
| FR11 | Явна відмова при race condition | Epic 3 → Story 3.2 | ✅ Covered |
| FR12 | Підтвердження вибору з назвою | Epic 3 → Story 3.3 | ✅ Covered |
| FR13 | Не більше однієї теми | Epic 3 → Story 3.2 | ✅ Covered |
| FR14 | Неможливість самостійно скасувати | Epic 3 → Story 3.3 | ✅ Covered |
| FR15 | Повторний вхід показує вибрану тему | Epic 3 → Story 3.3 | ✅ Covered |
| FR16 | Адмін додає учня | Epic 2 → Story 2.1 | ✅ Covered |
| FR17 | Адмін видаляє учня | Epic 2 → Story 2.1 | ✅ Covered |
| FR18 | Bulk upload учнів з CSV | Epic 2 → Story 2.2 | ✅ Covered |
| FR19 | Генерація пароля для нового учня | Epic 2 → Story 2.1, 2.2 | ✅ Covered |
| FR20 | CSV export credentials учнів | Epic 2 → Story 2.2 | ✅ Covered |
| FR21 | Адмін додає тему | Epic 2 → Story 2.4 | ✅ Covered |
| FR22 | Адмін видаляє тему | Epic 2 → Story 2.4 | ✅ Covered |
| FR23 | Bulk upload тем з CSV | Epic 2 → Story 2.5 | ✅ Covered |
| FR24 | Адмін звільняє тему | Epic 2 → Story 2.6 | ✅ Covered |
| FR25 | Статус всіх тем (вільна/зайнята+ким) | Epic 4 → Story 4.1 | ✅ Covered |
| FR26 | CSV export статусу тем | Epic 4 → Story 4.2 | ✅ Covered |
| FR27 | Перегляд audit log | Epic 4 → Story 4.3 | ✅ Covered |
| FR28 | CSV export audit log | Epic 4 → Story 4.4 | ✅ Covered |
| FR29 | Логування кожного входу | Epic 4 → Stories 1.3, 4.3 | ✅ Covered |
| FR30 | Логування спроби вибору теми | Epic 4 → Story 3.2 | ✅ Covered |
| FR31 | Логування всіх адмін-операцій | Epic 4 → всі Admin stories | ✅ Covered |

### Missing Requirements

**Немає відсутніх FRs.** Всі 31 функціональних вимог PRD покриті в epics.

**Додаткова знахідка (позитивна):** NFR9 у PRD позначено як "TBD в архітектурі", проте в epics вже конкретизовано: **5 невдалих спроб → блокування на 15 хвилин** (Story 1.3, AC5). Розбіжність незначна — epics є більш актуальним документом.

### Coverage Statistics

- **Всього PRD FRs:** 31
- **FRs покриті в epics:** 31
- **Відсоток покриття:** **100%** ✅

---

## UX Alignment Assessment

### UX Document Status

✅ **Знайдено:** `ux-design-specification.md` (29,402 bytes, Feb 18 16:44) — повний, статус `complete`.

### UX ↔ PRD Alignment

**Сильне узгодження:**
- Всі 5 user journey з PRD відображені в UX flows (Journey 1–5)
- Ключові PRD вимоги (FR9, FR10, FR11) підкріплені конкретними UX рішеннями: `TopicConfirmDialog`, `RaceConditionAlert`, атомарна feedback модель
- Race condition handling (FR11): UX визначає людське повідомлення *"Цю тему щойно вибрав інший учень 😔"* — відповідає духу PRD

**UX доповнення (поза PRD, не конфліктні):**
- WCAG 2.1 AA accessibility (UX) — не в PRD, але підтримується shadcn/ui + Radix
- Mobile-first 375px primary breakpoint — логічно випливає з персони "учень між парами з телефоном"
- Skeleton loading замість spinner — UX enhancement
- `data-testid` на кожному компоненті — UX додає тестовість
- Inter font, Bold Purple design direction — дизайнерські рішення, без конфліктів

### UX ↔ Architecture Alignment

**Сильне узгодження:**
- Design system shadcn/ui + Tailwind ✅ — обидва документи погоджені
- TanStack Query v5 + `invalidateQueries(['topics'])` ✅ — і UX і Architecture підтверджують
- React Router v7 routing ✅ — погоджено
- Papa Parse client-side CSV ✅ — ADR-001 підтверджує
- CSS variables в globals.css для palette ✅ — Architecture вказує цей файл

### ⚠️ Виявлена Розбіжність: Login Response — Відсутній `selectedTopic`

**Тип:** Архітектурна невідповідність між документами
**Серйозність:** Середня — потребує вирішення до початку імплементації Story 1.3 / Story 3.3

**Проблема:**
- **Architecture (GAP-2 table):** `POST /auth/login` повертає `{ id, email, role }` — без `selectedTopic`
- **Epics Story 3.3:** `POST /auth/login` повертає `{ id, email, role, selectedTopic: { id, title } | null }` — потрібно для відображення `TopicConfirmedScreen` при повторному вході
- **UX Journey 3:** учень після повторного входу одразу бачить `TopicConfirmedScreen` — що потребує знання про вибрану тему

**Наслідок:** Без `selectedTopic` у login response — frontend не знає чи учень вже вибрав тему (бо `GET /topics` повертає тільки *вільні* теми, тема учня там відсутня). Можливі варіанти:
1. Додати `selectedTopic` до login response (epics підхід — простіший)
2. Додати окремий endpoint `GET /auth/me` або `GET /user/profile` (чистіший API design)

**Рекомендація:** Прийняти підхід epics — додати `selectedTopic` до login response, оновити architecture GAP-2 table.

### Warnings

Жодних критичних попереджень щодо UX coverage. Одна архітектурна розбіжність (вище) потребує узгодження перед імплементацією.

---

## Epic Quality Review

### Критерії перевірки (Best Practices)

Per create-epics-and-stories standards:
- Epics deliver user value (not technical milestones)
- Epic independence (no forward dependencies)
- Stories: independent, properly sized, BDD ACs, testable

---

### Epic 1: Інфраструктура та Автентифікація

**User Value:** ⚠️ Borderline — назва містить "Інфраструктура" (технічний термін), але МЕТА epic є user-centric: *"Обидва типи користувачів можуть увійти в розгорнуту систему"*. FRs covered (FR1–FR5) = чисті auth вимоги. Для Greenfield проєкту наявність setup stories — очікувана норма.

**Epic Independence:** ✅ Стоїть самостійно, нічого не потребує.

| Story | User Value | ACs Format | Completeness | Проблеми |
|-------|-----------|------------|--------------|---------|
| 1.1 Монорепо init | ✅ Dev setup (Greenfield норма) | Given/When/Then ✅ | ✅ | — |
| 1.2 Зовнішні сервіси | ✅ Infra (ручна, Greenfield норма) | Частково (sub-tasks без ACs) | ⚠️ | Sub-tasks без formal ACs |
| 1.3 Вхід та сесія | ✅ FR1–FR4 | Given/When/Then ✅ | ✅ | Великий (13 ACs, bundle BE+FE) — прийнятно для 7 днів |
| 1.4 Вихід | ✅ FR5 | Given/When/Then ✅ | ✅ | — |

**🟡 Мінор:** Story 1.2 sub-tasks (MongoDB, Terraform, SSM, deploy) задокументовані як чек-листи без formal ACs — знижує testability. Прийнятно для ручних інфраструктурних кроків.

---

### Epic 2: Адмін-Налаштування — Учні та Теми

**User Value:** ✅ Адмін є користувачем — його потреба "підготувати систему до запуску" є чіткою user value.

**Epic Independence:** ✅ Потребує Epic 1 (auth) — коректна однонаправлена залежність.

| Story | User Value | ACs Format | Completeness | Проблеми |
|-------|-----------|------------|--------------|---------|
| 2.1 Учні CRUD | ✅ FR16, FR17, FR19 | GWT ✅ | ✅ | — |
| 2.2 Bulk upload + CSV export | ✅ FR18, FR20 | GWT ✅ | ✅ | — |
| 2.3 Скидання пароля | ✅ FR6 | GWT ✅ | ✅ | Важлива security note: newPassword не логується ✅ |
| 2.4 Теми CRUD | ✅ FR21, FR22 | GWT ✅ | ✅ | — |
| 2.5 Bulk upload тем | ✅ FR23 | GWT ✅ | ✅ | — |
| 2.6 Звільнення теми | ✅ FR24 | GWT ✅ | ✅ | Atomic via findOneAndUpdate ✅ |

**Жодних порушень.** Epic 2 — зразковий.

---

### Epic 3: Учнівський Досвід — Вибір Теми

**User Value:** ✅ Чітко user-centric. Центральний epic продукту.

**Epic Independence:** ✅ Потребує Epic 1 (auth). Операційна залежність від Epic 2 (теми у БД) — не code dependency, прийнятно.

| Story | User Value | ACs Format | Completeness | Проблеми |
|-------|-----------|------------|--------------|---------|
| 3.1 Перегляд тем | ✅ FR7, FR8 | GWT ✅ | ✅ | — |
| 3.2 Вибір + race condition | ✅ FR9–FR11, FR13 | GWT ✅ | ✅ Дуже ретельний | — |
| 3.3 Підтвердження + повторний вхід | ✅ FR12, FR14, FR15 | GWT ✅ | ⚠️ | **Login response gap** |

**🟠 Важлива проблема (Story 3.3, AC2):**
> Story 3.3 AC: `POST /auth/login` повертає `{ id, email, role, selectedTopic: { id, title } | null }` — проте Architecture документує login response як `{ id, email, role }` (без `selectedTopic`).
>
> **Наслідок:** якщо реалізувати Architecture буквально, Story 3.3 буде непрацездатна — учень при повторному вході не побачить `TopicConfirmedScreen` без окремого API call.
>
> **Рекомендація:** Прийняти версію з epics. Оновити Architecture GAP-2: додати `selectedTopic: { id, title, description } | null` до login response.

---

### Epic 4: Адмін-Видимість — Моніторинг та Аудит

**User Value:** ✅ Адмін-visibility — ключова потреба для моніторингу та звітності.

**Epic Independence:** ✅ Залежить від Epic 1 (auth), operational dependency від Epic 2 (дані), Epic 3 (selections for audit). Жодних forward references.

| Story | User Value | ACs Format | Completeness | Проблеми |
|-------|-----------|------------|--------------|---------|
| 4.1 Дашборд | ✅ FR25 | GWT ✅ | ✅ | — |
| 4.2 CSV export статусу | ✅ FR26 | GWT ✅ | ✅ | — |
| 4.3 Audit log | ✅ FR27 | GWT ✅ | ✅ | Важлива деталь: no circular logging для read-only ✅ |
| 4.4 CSV export audit | ✅ FR28 | GWT ✅ | ✅ | — |

**Жодних порушень.** Epic 4 — зразковий.

---

### Starter Template Check

✅ Greenfield проєкт — Story 1.1 є першою story і включає ініціалізацію monorepo з starter template (`npm create vite@latest`, shadcn init, `npm init -y`). Повністю відповідає best practice.

---

### Compliance Checklist Summary

| Критерій | Epic 1 | Epic 2 | Epic 3 | Epic 4 |
|---------|--------|--------|--------|--------|
| Delivers user value | ⚠️ Borderline (OK for Greenfield) | ✅ | ✅ | ✅ |
| Epic independence | ✅ | ✅ | ✅ | ✅ |
| Stories sized appropriately | ✅ | ✅ | ✅ | ✅ |
| No forward dependencies | ✅ | ✅ | ✅ | ✅ |
| Clear Given/When/Then ACs | ✅ | ✅ | ✅ | ✅ |
| FR traceability maintained | ✅ | ✅ | ✅ | ✅ |

### Findings Summary

**🔴 Critical Violations:** 0

**🟠 Major Issues:** 1
- Story 3.3 / Architecture conflict: `selectedTopic` відсутній в login response Architecture — потребує виправлення до імплементації

**🟡 Minor Concerns:** 2
- Epic 1 title: "Інфраструктура" в назві — технічний термін (Greenfield виключення, прийнятно)
- Story 1.2: sub-tasks без formal ACs (ручна інфраструктура, прийнятно)

---

## Summary and Recommendations

### Overall Readiness Status

> # ✅ READY (з одним обов'язковим виправленням)

Проєкт **lit** демонструє високу готовність до імплементації. PRD, Architecture, Epics і UX Design — всі документи наявні, повні та добре узгоджені. Виявлено **1 Major** архітектурну розбіжність і **2 Minor** concerns — жодних критичних блокерів.

---

### Critical Issues Requiring Immediate Action

#### 🟠 MAJOR — Обов'язково виправити до Story 1.3 / Story 3.3

**[ISSUE-1] Login Response — відсутній `selectedTopic`**

| | Деталь |
|---|---|
| Де | `architecture.md` → GAP-2 table / Story 3.3 AC2 |
| Проблема | Architecture: `POST /auth/login` → `{ id, email, role }`. Epics Story 3.3: вимагає `selectedTopic: { id, title } | null` в login response. |
| Наслідок | Без виправлення — учень при повторному вході **не побачить** `TopicConfirmedScreen`. Frontend не має способу дізнатись про вибрану тему (бо `GET /topics` показує тільки вільні теми). |
| Рішення | Оновити `architecture.md` GAP-2: `POST /auth/login` → `{ id, email, role, selectedTopic: { id, title, description } \| null }` |
| Зусилля | ~5 хв (правка в одному рядку документа) |

---

### Recommended Next Steps

1. **[Зараз] Виправити architecture.md GAP-2** — додати `selectedTopic` до login response. Це займе 5 хвилин і знімає єдиний блокер.

2. **[Перед Story 1.3] Перевірити backend auth handler** — переконатись що `POST /auth/login` повертає `selectedTopic` при реалізації (не лише в документах).

3. **[Перед Story 3.3] Перевірити frontend login flow** — `useAuth.ts` hook повинен обробляти `selectedTopic` з login response і перенаправляти на `TopicConfirmedScreen` якщо `selectedTopic !== null`.

4. **[Опціонально] Story 1.2 ACs** — якщо потрібна формальна testability, додати ACs для кожного sub-task. Для 7-денного проєкту поточна форма прийнятна.

5. **[Post-MVP] Уточнити Epic 1 назву** — "Інфраструктура та Автентифікація" → "Готовність до входу та технічна основа" або аналогічне user-centric формулювання.

---

### Final Note

Це оцінювання виявило **3 питання** в **2 категоріях** (архітектурна розбіжність + minor concerns):

| # | Тип | Категорія | Статус |
|---|-----|-----------|--------|
| ISSUE-1 | 🟠 Major | Architecture ↔ Epics conflict (login response) | Потребує виправлення |
| ISSUE-2 | 🟡 Minor | Epic 1 назва (технічний термін) | Опціонально |
| ISSUE-3 | 🟡 Minor | Story 1.2 sub-tasks без ACs | Опціонально |

**Загальна оцінка документації:** Дуже висока якість. 31 FR з 100% покриттям в epics, детальні Given/When/Then ACs, узгоджені UX + Architecture рішення. Команда/агент може починати імплементацію після виправлення ISSUE-1.

---

*Звіт згенеровано: 2026-02-19 | Assessor: BMad Master*
