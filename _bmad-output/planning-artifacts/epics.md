---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-02-19'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/architecture.md'
---

# lit - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for lit, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Учень може увійти в систему за email і паролем
FR2: Адмін може увійти в систему за email і паролем
FR3: Система розрізняє ролі `student` і `admin` та обмежує доступ відповідно
FR4: Автентифікована сесія зберігається між переходами сторінок
FR5: Користувач може вийти з системи
FR6: Адмін може скинути пароль учня (генерує новий, доступний через CSV export)
FR7: Учень може переглядати список тільки вільних тем
FR8: Учень може переглянути назву, опис, наукового керівника та кафедру будь-якої вільної теми до вибору
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
FR21: Адмін може додати тему (назва, опис, науковий керівник, кафедра)
FR22: Адмін може видалити тему
FR23: Адмін може завантажити список тем з CSV-файлу (bulk upload); CSV колонки: `title,description,supervisor,department`
FR24: Адмін може звільнити тему (повернути у список вільних)
FR25: Адмін може переглядати поточний статус всіх тем (назва, кафедра, керівник, вільна / зайнята + ким)
FR26: Адмін може вивантажити поточний статус у форматі CSV; колонки: `title,description,supervisor,department,studentName,studentEmail,status`
FR27: Адмін може переглядати audit log дій у системі
FR28: Адмін може вивантажити audit log у форматі CSV
FR29: Система логує кожен вхід (actor, timestamp, IP, result)
FR30: Система логує кожну спробу вибору теми (actor, тема, timestamp, IP, result: success/denied)
FR31: Система логує всі адмін-операції (тип операції, timestamp, IP)

### NonFunctional Requirements

NFR1: API відповідає на запити читання за ≤2с при нормальному навантаженні
NFR2: Операція вибору теми завершується за ≤3с включно з lock-механізмом
NFR3: Lambda cold start ≤5с — прийнятно для внутрішнього інструменту
NFR4: Система витримує одночасну роботу ~90 учнів без деградації
NFR5: Паролі зберігаються виключно у вигляді bcrypt hash (min cost factor 10)
NFR6: JWT в httpOnly, Secure, SameSite=None cookie; термін дії ≤24h
NFR7: Всі комунікації клієнт↔API по HTTPS
NFR8: API Gateway throttling: ≤10 req/хв на auth endpoint з одного IP
NFR9: Після 5 невдалих спроб логіну акаунт блокується на 15 хвилин
NFR10: MongoDB Atlas M0 — доступ через connection string в SSM; мережевий доступ `0.0.0.0/0` з TLS
NFR11: Операція вибору теми або завершується успіхом, або повертає явну помилку (no silent failure)
NFR12: При збої write-операції дані залишаються консистентними (no partial writes)
NFR13: CSV export доступний завжди незалежно від стану ongoing selections
NFR14: Щомісячні витрати AWS ≤$0 (Free Tier: Lambda 1M req, API Gateway 1M req)
NFR15: Cloudflare Free tier — без платних features

### Additional Requirements

**З Architecture:**
- Starter setup: `npm create vite@latest frontend -- --template react-ts` + `mkdir backend && npm init -y` — перша story в Epic 1
- MongoDB Atlas M0 кластер + DB user (readWrite на collections: users, topics, audit_log) — потрібен до першого backend тесту
- Terraform Cloud workspace ініціалізація + SSM Parameter Store (/lit/mongodb-uri, /lit/jwt-secret, /lit/cors-origin) — потрібні до першого Lambda deploy
- Lambda monolith: один handler (`index.mjs`) з `router.mjs` (route map pattern)
- `respond()` helper реекспортується з `router.mjs` — всі handlers імпортують звідти
- `mapId()` helper в `lib/db.mjs` — обов'язковий для всіх MongoDB responses
- `logAudit()` в `lib/audit.mjs` — cross-cutting, викликається після кожної state-changing операції
- SSM singleton caching в `ssm.mjs` — secrets читаються один раз при cold start
- `bcryptjs@^2.4.3` (pure JS), `mongodb@^6.0.0`, `jsonwebtoken@^9.0.0`, `@aws-sdk/client-ssm@^3.0.0`
- Papa Parse (client-side) для CSV parsing → надсилає JSON payload; server-side тільки JSON validation
- CORS: `Access-Control-Allow-Origin: exact CF Pages domain` + `credentials: true`

**З UX Design:**
- Mobile-first: учнівський UI для 375px primary, `max-width: 480px` centered на desktop
- Адмін-панель: desktop-first, sidebar collapse при <768px до верхніх tabs
- WCAG 2.1 AA: contrast ≥4.5:1, touch targets ≥44×44px, keyboard navigation, semantic HTML
- Шрифт Inter (Google Fonts)
- Весь UI текст українською (hardcoded, без i18n)
- Кожен компонент має `data-testid` атрибут для E2E тестів
- TopicConfirmDialog: фокус на безпечній кнопці "Назад до списку" при відкритті
- RaceConditionAlert: auto-dismiss через 8с
- Spinner на кнопці + disabled під час API-запиту
- Skeleton loading (не spinner) для початкового завантаження списку тем
- CSV upload: drag & drop + preview перших 3 рядків
- Пошук: debounce 300ms + кнопка очищення

### FR Coverage Map

FR1: Epic 1 — Вхід учня за email/паролем
FR2: Epic 1 — Вхід адміна за email/паролем
FR3: Epic 1 — Розмежування ролей student/admin, обмеження доступу
FR4: Epic 1 — Збереження сесії між переходами сторінок
FR5: Epic 1 — Вихід із системи
FR6: Epic 2 — Скидання пароля учня адміном
FR7: Epic 3 — Перегляд списку вільних тем
FR8: Epic 3 — Перегляд назви, опису, наукового керівника та кафедри теми до вибору
FR9: Epic 3 — Вибір однієї теми зі списку
FR10: Epic 3 — Гарантія: одну тему може вибрати рівно один учень (atomic)
FR11: Epic 3 — Явне повідомлення про відмову при race condition
FR12: Epic 3 — Підтвердження вибору з назвою теми
FR13: Epic 3 — Неможливість вибрати більше однієї теми
FR14: Epic 3 — Неможливість самостійно скасувати вибір
FR15: Epic 3 — Повторний вхід показує вибрану тему
FR16: Epic 2 — Адмін додає учня (ім'я, email)
FR17: Epic 2 — Адмін видаляє учня
FR18: Epic 2 — Bulk upload учнів з CSV
FR19: Epic 2 — Система генерує пароль для нового учня
FR20: Epic 2 — CSV export credentials учнів
FR21: Epic 2 — Адмін додає тему (назва, опис, науковий керівник, кафедра)
FR22: Epic 2 — Адмін видаляє тему
FR23: Epic 2 — Bulk upload тем з CSV
FR24: Epic 2 — Адмін звільняє тему (повертає у список вільних)
FR25: Epic 4 — Адмін переглядає статус всіх тем (вільна/зайнята + ким)
FR26: Epic 4 — CSV export поточного статусу тем
FR27: Epic 4 — Адмін переглядає audit log
FR28: Epic 4 — CSV export audit log
FR29: Epic 4 — Логування кожного входу (actor, timestamp, IP, result)
FR30: Epic 4 — Логування кожної спроби вибору теми
FR31: Epic 4 — Логування всіх адмін-операцій

## Epic List

### Epic 1: Інфраструктура та Автентифікація
Обидва типи користувачів можуть увійти в розгорнуту систему. Весь технічний фундамент готовий для подальшої розробки.
**FRs covered:** FR1, FR2, FR3, FR4, FR5
**Архітектурні requirements:** монорепо init, MongoDB Atlas M0, Terraform Cloud, SSM Parameter Store, Lambda first deploy

### Epic 2: Адмін-Налаштування — Учні та Теми
Адмін може повністю підготувати систему до запуску: завантажити учнів з автогенерованими паролями, підготувати список тем, управляти даними після запуску.
**FRs covered:** FR6, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24

### Epic 3: Учнівський Досвід — Вибір Теми
Учень може пройти повний flow вибору теми: переглянути список, вибрати тему з підтвердженням, отримати зрозумілу відмову при race condition, бачити свою тему при повторному вході.
**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15

### Epic 4: Адмін-Видимість — Моніторинг та Аудит
Адмін має повний огляд стану системи: статус розподілу тем, CSV-звіти, audit log всіх дій.
**FRs covered:** FR25, FR26, FR27, FR28, FR29, FR30, FR31

## Epic 1: Інфраструктура та Автентифікація

Обидва типи користувачів можуть увійти в розгорнуту систему. Весь технічний фундамент готовий для подальшої розробки.

### Story 1.1: Ініціалізація монорепо

As a developer,
I want an initialized monorepo with frontend, backend, and infra scaffolds,
So that development can begin with a consistent structure across all parts of the project.

**Acceptance Criteria:**

**Given** корінь репозиторію,
**When** frontend ініціалізовано через `npm create vite@latest frontend -- --template react-ts` і `npx shadcn@latest init`,
**Then** існують `frontend/src/main.tsx`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `components.json`

**Given** `backend/package.json`,
**When** він містить `"type": "module"`,
**Then** всі `.mjs` файли завантажуються без CommonJS помилок

**Given** `infra/` з Terraform файлами (main.tf, variables.tf, lambda.tf, apigateway.tf, iam.tf, ssm.tf, terraform.tf),
**When** виконати `terraform validate`,
**Then** команда завершується без помилок

**Given** `.gitignore` в корені,
**When** перевірити його вміст,
**Then** `*.tfstate`, `*.tfstate.backup`, `.env`, `node_modules` присутні в списку

### Story 1.2: Зовнішні сервіси та перший деплой

As a developer,
I want all external services configured and the Lambda deployed,
So that the backend API is reachable and ready for feature development.

> ⚠️ **Примітка для агента:** Ця story виконується виключно розробником вручну. Агент **не виконує** жодних кроків самостійно — лише надає покрокові інструкції на запит. Перед кожним sub-task розробник може попросити агента пояснити деталі.

**Sub-tasks (sequential — виконує розробник):**
- [ ] Створити MongoDB Atlas M0 cluster + DB user (readWrite на `users`, `topics`, `audit_log`)
- [ ] Ініціалізувати Terraform Cloud workspace (`terraform login` + `terraform init`)
- [ ] Заповнити SSM Parameter Store: `/lit/mongodb-uri`, `/lit/jwt-secret`, `/lit/cors-origin`
- [ ] `terraform apply` → Lambda + API Gateway live

**Acceptance Criteria:**

**Given** MongoDB Atlas cluster і SSM `/lit/mongodb-uri`,
**When** Lambda cold start викликає `getSecrets()` з `ssm.mjs`,
**Then** secrets кешуються у module-level змінній — жодного SSM API call при повторних invocations

**Given** задеплоєна Lambda,
**When** `GET /health`,
**Then** відповідь `{"status":"ok"}` зі статусом 200

**Given** API Gateway URL і `CORS_ORIGIN` (значення з SSM `/lit/cors-origin`),
**When** CORS preflight `OPTIONS` запит із відповідного origin,
**Then** відповідь містить `Access-Control-Allow-Origin: <origin>` і `Access-Control-Allow-Credentials: true`

### Story 1.3: Вхід в систему та збереження сесії

As a student or admin,
I want to log in with my email and password,
So that I can access my role-specific area and remain authenticated across page navigations.

**Acceptance Criteria:**

**Given** валідні credentials учня,
**When** `POST /auth/login`,
**Then** відповідь `200` з body `{ id, email, role: "student" }` і встановлений cookie `httpOnly; Secure; SameSite=None; MaxAge=86400`

**Given** валідні credentials адміна,
**When** `POST /auth/login`,
**Then** відповідь `200` з body `{ id, email, role: "admin" }` і cookie встановлений

**Given** невірний пароль АБО невідомий email,
**When** `POST /auth/login`,
**Then** відповідь `401` з `{ error: "INVALID_CREDENTIALS", message: "Невірний email або пароль" }` — однакова відповідь для обох випадків

**Given** невідомий email,
**When** `POST /auth/login`,
**Then** `bcrypt.compare(password, DUMMY_HASH)` виконується (захист від timing attack)

**Given** 5 невдалих спроб підряд для одного email,
**When** 6-та спроба,
**Then** відповідь `423` з `{ error: "ACCOUNT_LOCKED", lockedUntil: <ISO timestamp +15хв> }`

**Given** валідний JWT cookie,
**When** `GET /topics` (учень) або `GET /admin/topics` (адмін),
**Then** відповідь `200`

**Given** учнівський cookie,
**When** `GET /admin/topics`,
**Then** відповідь `403 Forbidden`

**Given** відсутній або прострочений cookie,
**When** будь-який захищений маршрут,
**Then** відповідь `401 Unauthorized`

**Given** логін (успішний або невдалий),
**When** операція завершена,
**Then** `logAudit(db, { actor: email, action: "LOGIN", ip, result: "success"|"failed"|"locked" })` викликано

**Given** `LoginPage`,
**When** успішний вхід учня,
**Then** редірект на `/topics`

**Given** `LoginPage`,
**When** успішний вхід адміна,
**Then** редірект на `/admin`

**Given** помилка логіну,
**When** відповідь від API,
**Then** повідомлення відображається inline під формою, без перезавантаження сторінки

### Story 1.4: Вихід із системи

As a logged-in user,
I want to log out,
So that my session is cleared and no one else can use my account on this device.

**Acceptance Criteria:**

**Given** автентифікований користувач,
**When** `POST /auth/logout`,
**Then** відповідь `200` і cookie очищений (`Set-Cookie` з `maxAge=0`)

**Given** очищений cookie,
**When** будь-який захищений маршрут,
**Then** відповідь `401 Unauthorized`

**Given** кнопка виходу в UI (учень: header; адмін: sidebar),
**When** натиснута,
**Then** `POST /auth/logout` виконано і редірект на `/login`

**Given** вихід із системи,
**When** операція завершена,
**Then** `logAudit(db, { actor: userId, action: "LOGOUT", ip, result: "success" })` викликано

## Epic 2: Адмін-Налаштування — Учні та Теми

Адмін може повністю підготувати систему до запуску: завантажити учнів з автогенерованими паролями, підготувати список тем, управляти даними після запуску.

### Story 2.1: Управління учнями — перегляд, додавання, видалення

As an admin,
I want to view, add, and delete students individually,
So that I can manage the student list and ensure each student has access to the system.

**Acceptance Criteria:**

**Given** автентифікований адмін,
**When** `GET /admin/users`,
**Then** відповідь `200` з масивом `[{ id, name, email, hasSelectedTopic: bool }]`

**Given** валідні дані `{ name, email }`,
**When** `POST /admin/users`,
**Then** відповідь `201` з `{ id, name, email, newPassword }` — пароль повернений **один раз** у відповіді, зберігається тільки bcrypt hash

**Given** `POST /admin/users` з email що вже існує,
**When** запит виконано,
**Then** відповідь `409` з `{ error: "EMAIL_ALREADY_EXISTS", message: "Учень з таким email вже існує" }`

**Given** існуючий учень,
**When** `DELETE /admin/users/:id`,
**Then** відповідь `204 No Content`

**Given** неіснуючий id,
**When** `DELETE /admin/users/:id`,
**Then** відповідь `404`

**Given** `AdminStudentsPage`,
**When** сторінка завантажена,
**Then** таблиця відображає ім'я, email, статус вибору теми та кнопки дій

**Given** кожна write-операція (CREATE, DELETE),
**When** операція завершена,
**Then** `logAudit(db, { actor: adminId, action: "CREATE_USER"|"DELETE_USER", targetId, ip, result })` викликано

### Story 2.2: Bulk upload учнів та export credentials

As an admin,
I want to upload a CSV with multiple students and immediately download their credentials,
So that I can quickly populate the system and send login details to all students at once.

**Acceptance Criteria:**

**Given** CSV файл з колонками `name,email`,
**When** адмін обирає файл (drag & drop або file picker),
**Then** Papa Parse парсить client-side і показує preview перших 3 рядків перед відправкою

**Given** підтверджений CSV payload,
**When** `POST /admin/users/bulk` з JSON масивом `[{ name, email }]`,
**Then** відповідь `200` з `{ created: N, users: [{ name, email, password }], errors: [{ row, message }] }`

**Given** дублікати email в CSV або у БД,
**When** обробка рядка,
**Then** рядок пропускається з описом у `errors`, решта створюються

**Given** успішна відповідь від `POST /admin/users/bulk`,
**When** `users` масив не порожній,
**Then** UI показує кнопку "Завантажити CSV з паролями" — CSV генерується client-side з даних відповіді (Papa Parse unparse)

**Given** завантажений CSV credentials,
**When** відкрити файл,
**Then** містить колонки `name,email,password` для всіх успішно створених учнів

**Given** bulk upload (успішний або частковий),
**When** операція завершена,
**Then** `logAudit(db, { actor: adminId, action: "BULK_CREATE_USERS", count: N, ip, result })` викликано

### Story 2.3: Скидання пароля учня

As an admin,
I want to reset a student's password,
So that I can help a student who has forgotten their credentials without deleting their account.

**Acceptance Criteria:**

**Given** існуючий учень,
**When** `POST /admin/users/:id/reset-password`,
**Then** відповідь `200` з `{ newPassword }` — новий пароль повернений **один раз**, зберігається тільки bcrypt hash

**Given** `AdminStudentsPage`,
**When** адмін натискає "Скинути пароль" для учня,
**Then** новий пароль відображається у модалці один раз з підказкою скопіювати

**Given** скидання пароля,
**When** операція завершена,
**Then** `logAudit(db, { actor: adminId, action: "RESET_PASSWORD", targetId, ip, result })` викликано — `newPassword` **не логується**

### Story 2.4: Управління темами — перегляд, додавання, видалення

As an admin,
I want to view, add, and delete thesis topics,
So that I can maintain the list of topics available for students to choose from.

**Acceptance Criteria:**

**Given** автентифікований адмін,
**When** `GET /admin/topics`,
**Then** відповідь `200` з масивом `[{ id, title, description, supervisor, department, selectedBy: { id, name } | null }]`

**Given** валідні дані `{ title, description, supervisor, department }`,
**When** `POST /admin/topics`,
**Then** відповідь `201` з `{ id, title, description, supervisor, department, selectedBy: null }`

**Given** тема з `selectedBy !== null`,
**When** `DELETE /admin/topics/:id`,
**Then** відповідь `409` з `{ error: "TOPIC_IN_USE", message: "Тема вже вибрана учнем — спочатку звільніть її" }`

**Given** вільна тема,
**When** `DELETE /admin/topics/:id`,
**Then** відповідь `204 No Content`

**Given** `AdminTopicsPage`,
**When** сторінка завантажена,
**Then** таблиця відображає назву, опис, ім'я учня (або "вільна") та кнопки дій

**Given** кожна write-операція (CREATE, DELETE),
**When** операція завершена,
**Then** `logAudit(db, { actor: adminId, action: "CREATE_TOPIC"|"DELETE_TOPIC", targetId, ip, result })` викликано

### Story 2.5: Bulk upload тем з CSV

As an admin,
I want to upload a CSV file with multiple topics at once,
So that I can quickly populate the topic list without adding each topic manually.

**Acceptance Criteria:**

**Given** CSV файл з колонками `title,description,supervisor,department`,
**When** адмін обирає файл,
**Then** Papa Parse парсить client-side і показує preview перших 3 рядків

**Given** підтверджений CSV payload,
**When** `POST /admin/topics/bulk` з JSON масивом `[{ title, description, supervisor, department }]`,
**Then** відповідь `200` з `{ created: N, errors: [{ row, message }] }`

**Given** рядок без `title` або `supervisor`,
**When** обробка рядка,
**Then** рядок пропускається з описом у `errors`, решта створюються

**Given** bulk upload тем,
**When** операція завершена,
**Then** `logAudit(db, { actor: adminId, action: "BULK_CREATE_TOPICS", count: N, ip, result })` викликано

### Story 2.6: Звільнення теми адміном

As an admin,
I want to release a student's selected topic back to the available list,
So that the student can choose a different topic if they made a mistake.

**Acceptance Criteria:**

**Given** тема з `selectedBy !== null`,
**When** `POST /admin/topics/:id/release`,
**Then** відповідь `200` з `{ topic: { id, title, description, selectedBy: null } }` — атомарна операція через `findOneAndUpdate`

**Given** вже вільна тема (`selectedBy: null`),
**When** `POST /admin/topics/:id/release`,
**Then** відповідь `409` з `{ error: "TOPIC_ALREADY_FREE", message: "Тема вже вільна" }`

**Given** `AdminTopicsPage`,
**When** адмін натискає "Звільнити тему" для зайнятої теми,
**Then** після підтвердження у модалці виконується запит і таблиця оновлюється

**Given** звільнення теми,
**When** операція завершена,
**Then** `logAudit(db, { actor: adminId, action: "RELEASE_TOPIC", targetId, ip, result })` викликано

## Epic 3: Учнівський Досвід — Вибір Теми

Учень може пройти повний flow вибору теми: переглянути список, вибрати тему з підтвердженням, отримати зрозумілу відмову при race condition, бачити свою тему при повторному вході.

### Story 3.1: Перегляд списку вільних тем

As a student,
I want to browse available thesis topics with their descriptions,
So that I can make an informed decision about which topic suits me before committing.

**Acceptance Criteria:**

**Given** автентифікований учень,
**When** `GET /topics`,
**Then** відповідь `200` з масивом `[{ id, title, description, supervisor, department }]` — тільки теми де `selected_by: null`

**Given** `TopicsPage`,
**When** сторінка завантажується,
**Then** відображаються skeleton-рядки (3–5 штук) до отримання відповіді від API

**Given** список тем завантажено,
**When** учень натискає на назву теми,
**Then** `TopicAccordionItem` розкривається in-place: показує опис, наукового керівника, кафедру і кнопку "Вибрати цю тему" з `border-l-4 border-[#B436F0]`

**Given** пошуковий рядок (debounce 300ms),
**When** учень вводить текст,
**Then** список фільтрується client-side за назвою теми

**Given** пошук без збігів,
**When** жодна тема не відповідає запиту,
**Then** відображається "Нічого не знайдено за запитом «[query]»"

**Given** всі теми вже вибрані (порожній масив від API),
**When** список завантажено,
**Then** відображається "Всі теми вже вибрані. Зверніться до вчителя."

**Given** мобільний пристрій (375px),
**When** сторінка відкрита,
**Then** touch targets кожного accordion item ≥ 44px висота, горизонтальний padding 16px

### Story 3.2: Вибір теми з підтвердженням та race condition handling

As a student,
I want to select a topic with a confirmation step and receive clear feedback on success or failure,
So that I know exactly whether my selection was recorded or if I need to choose another topic.

**Acceptance Criteria:**

**Given** розкритий `TopicAccordionItem`,
**When** учень натискає "Вибрати цю тему",
**Then** `TopicConfirmDialog` відкривається з текстом: *"Ти вибираєш: [Назва теми]. Змінити самостійно не можна — тільки через вчителя."*

**Given** відкритий `TopicConfirmDialog`,
**When** учень клікає на overlay (поза модалкою),
**Then** діалог **не закривається**

**Given** відкритий `TopicConfirmDialog`,
**When** він з'являється,
**Then** фокус встановлено на кнопку "Назад до списку" (безпечніша дія)

**Given** учень підтверджує вибір,
**When** `POST /topics/:id/select` виконується,
**Then** кнопка "Так, беру цю тему" показує spinner і стає `disabled` до отримання відповіді

**Given** успішна відповідь `200`,
**When** `{ topic: { id, title, selectedBy } }` отримано,
**Then** учень переходить на `TopicConfirmedScreen`

**Given** відповідь `409 TOPIC_ALREADY_TAKEN`,
**When** race condition — тему щойно вибрав інший учень,
**Then** `RaceConditionAlert` відображається inline у верхній частині списку: *"Цю тему щойно вибрав інший учень 😔 Список оновлено — оберіть іншу."*

**Given** `RaceConditionAlert` відображено,
**When** минає 8 секунд,
**Then** alert зникає автоматично

**Given** учень що вже має вибрану тему (FR13),
**When** `POST /topics/:id/select`,
**Then** відповідь `409` з `{ error: "ALREADY_SELECTED" }` — повторний вибір неможливий

**Given** атомарна операція вибору,
**When** `POST /topics/:id/select` виконується,
**Then** MongoDB `findOneAndUpdate({ _id: topicId, selected_by: null }, { $set: { selected_by: userId } })` — нуль дублів при одночасних запитах

**Given** будь-який результат (success або 409),
**When** відповідь отримана,
**Then** `invalidateQueries(['topics'])` викликано — список тем оновлюється

**Given** спроба вибору теми,
**When** операція завершена,
**Then** `logAudit(db, { actor: userId, action: "SELECT_TOPIC", topicId, ip, result: "success"|"denied" })` викликано

### Story 3.3: Підтвердження вибору та повторний вхід

As a student,
I want to see confirmation of my selected topic and always see it when I return,
So that I'm certain my choice was recorded and I know who to contact if I want to change it.

**Acceptance Criteria:**

**Given** успішний вибір теми,
**When** учень потрапляє на `TopicConfirmedScreen`,
**Then** екран показує: checkmark (`#B436F0`), "Тему вибрано!", назву теми, *"Якщо потрібна зміна — звернись до вчителя"* — **без жодних кнопок дії**

**Given** учень закрив вкладку і повернувся (повторний вхід),
**When** після логіну відкривається `/topics`,
**Then** `POST /auth/login` повертає `{ id, email, role, selectedTopic: { id, title, description, supervisor, department } | null }` і при `selectedTopic !== null` одразу рендериться `TopicConfirmedScreen`

**Given** учень з вибраною темою,
**When** `GET /topics`,
**Then** його тема **відсутня** в списку (тільки `selected_by: null` теми) — учень не може "вибрати" свою ж тему повторно

**Given** учень намагається викликати `POST /topics/:id/release` напряму (обхід UI),
**When** запит виконується,
**Then** відповідь `404` — endpoint не існує для учнівської ролі (FR14 — backend enforced)

## Epic 4: Адмін-Видимість — Моніторинг та Аудит

Адмін має повний огляд стану системи: статус розподілу тем, CSV-звіти, audit log всіх дій.

### Story 4.1: Дашборд статусу розподілу тем

As an admin,
I want to see a real-time overview of topic selection progress,
So that I can monitor how many students have chosen their topics at a glance.

**Acceptance Criteria:**

**Given** автентифікований адмін,
**When** `AdminDashboardPage` завантажується,
**Then** `AdminStatCard` відображає "X / Y учнів вибрали тему" — X = кількість учнів з `hasSelectedTopic: true`, Y = загальна кількість учнів

**Given** дані з `GET /admin/users` і `GET /admin/topics` (вже кешовані TanStack Query),
**When** дашборд рендериться,
**Then** `Progress` компонент (shadcn) показує заповненість X/Y без додаткового API call

**Given** другий `AdminStatCard`,
**When** дашборд завантажено,
**Then** відображає "Z вільних тем з N загалом" — Z = теми де `selectedBy: null`

**Given** 0 учнів вибрали тему,
**When** дашборд відкрито,
**Then** прогрес "0 / Y" — без помилок рендерингу

**Given** всі учні вибрали теми,
**When** дашборд відкрито,
**Then** прогрес "Y / Y" — `AdminStatCard` з `border-[#B436F0]` (primary variant)

### Story 4.2: CSV export статусу тем

As an admin,
I want to download a CSV with the current status of all topics,
So that I can share a progress report with the department.

**Acceptance Criteria:**

**Given** автентифікований адмін,
**When** `GET /admin/export/status`,
**Then** CSV stream з колонками `title,description,supervisor,department,studentName,studentEmail,status` (status = "вільна" або "зайнята")

**Given** відповідь від `GET /admin/export/status`,
**When** заголовки відповіді перевірені,
**Then** `Content-Type: text/csv` і `Content-Disposition: attachment; filename="topics-status-<YYYY-MM-DD>.csv"`

**Given** кнопка "Завантажити CSV статусу" на `AdminDashboardPage`,
**When** натиснута,
**Then** браузер ініціює завантаження файлу

**Given** export статусу,
**When** операція завершена,
**Then** `logAudit(db, { actor: adminId, action: "EXPORT_STATUS", ip, result: "success" })` викликано

### Story 4.3: Перегляд audit log

As an admin,
I want to view a complete log of all system actions with actor, IP, and result,
So that I can detect suspicious activity and verify that operations completed correctly.

**Acceptance Criteria:**

**Given** автентифікований адмін,
**When** `GET /admin/audit`,
**Then** відповідь `200` з масивом `[{ id, actor, action, targetId, ip, result, createdAt }]` — відсортовано від нових до старих

**Given** `AdminAuditPage`,
**When** сторінка завантажена,
**Then** таблиця відображає колонки: час (ISO → локальний формат), actor (email або id), action, IP, result

**Given** audit log містить записи,
**When** перевірити типи `action`,
**Then** присутні всі задокументовані типи: `LOGIN`, `LOGOUT`, `SELECT_TOPIC`, `CREATE_USER`, `DELETE_USER`, `BULK_CREATE_USERS`, `RESET_PASSWORD`, `CREATE_TOPIC`, `DELETE_TOPIC`, `BULK_CREATE_TOPICS`, `RELEASE_TOPIC`, `EXPORT_STATUS`, `EXPORT_AUDIT`

**Given** 5 невдалих спроб логіну з одного IP,
**When** переглянути audit log,
**Then** 5 записів `action: "LOGIN", result: "failed"` з однаковим IP видимі адміну

**Given** `GET /admin/audit` запит,
**When** операція завершена,
**Then** `logAudit` **не викликається** для read-only операцій перегляду (уникаємо circular logging)

### Story 4.4: CSV export audit log

As an admin,
I want to download the full audit log as a CSV,
So that I can archive activity records or investigate incidents outside the system.

**Acceptance Criteria:**

**Given** автентифікований адмін,
**When** `GET /admin/export/audit`,
**Then** CSV stream з колонками `createdAt,actor,action,targetId,ip,result`

**Given** відповідь від `GET /admin/export/audit`,
**When** заголовки перевірені,
**Then** `Content-Type: text/csv` і `Content-Disposition: attachment; filename="audit-log-<YYYY-MM-DD>.csv"`

**Given** кнопка "Завантажити CSV аудиту" на `AdminAuditPage`,
**When** натиснута,
**Then** браузер ініціює завантаження файлу

**Given** export audit log,
**When** операція завершена,
**Then** `logAudit(db, { actor: adminId, action: "EXPORT_AUDIT", ip, result: "success" })` викликано
