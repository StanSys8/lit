---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-02-19'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
workflowType: 'architecture'
project_name: 'lit'
user_name: 'Ss'
date: '2026-02-18'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (31 вимога):**

Система складається з 5 функціональних доменів:

1. **Auth & Authorization (FR1–FR6)** — email/password login для двох ролей (student, admin), JWT-сесія, вихід, скидання пароля адміном. Архітектурний наслідок: middleware авторизації на всіх захищених маршрутах, RBAC на рівні API.

2. **Topic Discovery & Selection (FR7–FR15)** — студент бачить тільки вільні теми, обирає одну, система гарантує атомарність (нуль дублів), явна відмова при race condition, скасування тільки адміном. Архітектурний наслідок: атомарна write-операція з lock-механізмом — центральний технічний ризик.

3. **User Management Admin (FR16–FR20)** — CRUD студентів, bulk CSV upload, автогенерація паролів, CSV export credentials. Архітектурний наслідок: CSV processing на сервері або клієнті (TBD).

4. **Topic Management Admin (FR21–FR24)** — CRUD тем, bulk CSV upload, звільнення теми (повернення у список). Архітектурний наслідок: write-операція звільнення теми теж потребує consistent state.

5. **Reporting, Audit & Logging (FR25–FR31)** — real-time статус для адміна, CSV export стану і audit log, логування всіх дій (actor, IP, timestamp, result). Архітектурний наслідок: кожен API endpoint пише в audit log — cross-cutting concern.

**Non-Functional Requirements (архітектурно значущі):**

| NFR | Рішення |
|---|---|
| $0 AWS bill (Free Tier) | Lambda 1M req/міс, API GW 1M req/міс, S3 5GB |
| bcrypt min cost 10 | Синхронний hash при реєстрації/зміні пароля |
| JWT httpOnly/Secure/SameSite=Strict ≤24h | Server-side set-cookie, без localStorage |
| Rate limiting ≤10 req/хв на auth endpoint | API Gateway throttling + app-level lockout |
| Atomic select (no silent failures) | MongoDB `findOneAndUpdate` з умовою `selected_by: null` |
| ~90 concurrent users | Lambda auto-scaling, MongoDB Atlas M0 (500 connections) |
| Lambda cold start ≤5s (прийнятний) | Provisioned concurrency не потрібен |

**Scale & Complexity:**

- Primary domain: Full-stack Web (SPA + Serverless REST API + IaC)
- Complexity level: **Medium-High**
- Estimated architectural components: 8 (Auth, Topics API, User Mgmt API, Admin API, Audit Logger, SQLite Lock Mechanism, Frontend SPA, IaC/Deploy)

### Technical Constraints & Dependencies

- **Cloudflare Pages** для Frontend → статичний білд React+Vite
- **AWS Lambda (Node.js ESM)** + **API Gateway HTTP API** → функціональні обмеження ESM (import/export тільки)
- **MongoDB Atlas M0** → завжди онлайн, free forever, атомарні операції нативно, без lock-механізму
- **Terraform деплой з локалки** → state file management, .gitignore для *.tfstate; S3 не потрібен
- **$0 бюджет** → без RDS, без ElastiCache, без Cognito (paid features)
- **7-денний дедлайн** → мінімальна кількість рухомих частин, вибір встановлених паттернів
- **CORS** → API Gateway дозволяє лише Cloudflare Pages origin з credentials:true

### Cross-Cutting Concerns Identified

1. **Authentication Middleware** — перевірка JWT на кожному захищеному маршруті (`/topics/*`, `/admin/*`, `/audit/*`)
2. **Audit Logging** — кожен API endpoint (auth, topics, admin) пише в audit log з IP та timestamp
3. **Atomic Write** — MongoDB `findOneAndUpdate` з умовою `{ selected_by: null }` охоплює topic selection і topic release операції
4. **Error Response Format** — консистентний формат відповіді для всіх помилок (no silent failures)
5. **CORS Configuration** — єдина конфігурація між API Gateway і Lambda
6. **Rate Limiting** — auth endpoint throttling на рівні API Gateway + app-level lockout

## Starter Template Evaluation

### Primary Technology Domain

Full-stack Web: SPA (React + Vite) + Serverless REST API (AWS Lambda Node.js ESM).
Два окремих застосунки в монорепо.

### Project Structure

Монорепо з трьома директоріями:

```
lit/
├── frontend/   # React + Vite + shadcn/ui (Cloudflare Pages)
├── backend/    # Node.js ESM Lambda functions (AWS)
└── infra/      # Terraform (IaC)
```

Монорепо обрано тому що:
- Один репозиторій для 7-денного проєкту — простіше управляти
- Shared типи між frontend і backend (TypeScript interfaces для API responses)
- Єдиний git history і спрощений code review

### Starter Options Considered

**Frontend:**
- `npm create vite@latest` (react-ts) — стандартний, офіційний, Vite v7.3.1
- `npx create-react-app` — застарілий, не розглядається

**Backend:**
- Plain `npm init` + ручна структура Lambda — максимальний контроль, мінімум залежностей
- AWS SAM CLI — додає зайвий шар поверх Terraform (конфлікт IaC)
- Serverless Framework — теж конфлікт з Terraform

### Selected Starters

**Frontend — Vite + React + TypeScript:**

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npx shadcn@latest init
```

Вибрано тому що:
- Офіційний starter від Vite, активно підтримується (v7.3.1)
- react-ts template — TypeScript з коробки
- shadcn/ui init налаштовує Tailwind + CSS variables + компоненти

**Backend — Plain Node.js ESM Lambda:**

```bash
mkdir backend && cd backend
npm init -y
# Структура: src/handlers/, src/lib/, src/middleware/
```

Вибрано тому що:
- Terraform керує деплоєм — SAM/Serverless Framework зайві
- ESM (`"type": "module"` в package.json) — відповідно до PRD
- Мінімум залежностей = менше security surface

**Lambda Runtime: `nodejs24.x`** (підтримка до квітня 2028)

### Architectural Decisions Provided by Starters

**Language & Runtime:**
- TypeScript (frontend) + Node.js ESM (backend)
- tsconfig.json з коробки для frontend; backend без TS компілятора (plain .mjs)

**Styling Solution:**
- Tailwind CSS + shadcn/ui (CSS variables для кольорової палітри)
- CSS custom properties в globals.css для branding (#B436F0 primary)

**Build Tooling:**
- Frontend: Vite build → static dist/ → Cloudflare Pages deploy
- Backend: без build step — Node.js ESM native в Lambda

**Testing Framework:**
- Frontend: Vitest (встановлюється окремо)
- Backend: Node.js --test runner або Jest (TBD в story)

**Code Organization:**
- frontend/src/components/ui/ — shadcn/ui компоненти
- frontend/src/components/ — кастомні компоненти
- frontend/src/pages/ — сторінки (LoginPage, TopicsPage, AdminPage)
- backend/src/handlers/ — Lambda handlers по домену (auth, topics, admin, audit)
- backend/src/lib/ — shared utilities (db, jwt, bcrypt)
- backend/src/middleware/ — auth middleware

**Note:** Ініціалізація проєкту (ці команди) має бути першою implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical (блокують імплементацію):**
- MongoDB Atlas M0 з `findOneAndUpdate` для атомарного вибору теми
- `SameSite=None; Secure` для JWT cookie (обов'язково через cross-origin CF Pages ↔ API GW)
- Централізований role middleware для `/admin/*`
- `maxPoolSize: 5` для Lambda MongoDB client

**Important (формують архітектуру):**
- AWS SSM Parameter Store для всіх secrets
- Один Lambda monolith з internal routing
- Client-side CSV parsing (Papa Parse) + server-side JSON validation
- Terraform Cloud free tier для state
- Dummy bcrypt compare при невідомому email

**Deferred (post-MVP):**
- TypeScript на backend (зараз plain .mjs)
- MFA для адміна
- Shared types між frontend і backend

### Data Architecture

**Database: MongoDB Atlas M0**
- Collections: `users`, `topics`, `audit_log`
- `topics` document shape: `{ _id, title, description, supervisor, department, selected_by: ObjectId | null }`
- Atomic topic selection: `findOneAndUpdate({ _id, selected_by: null }, { $set: { selected_by: userId } })`
- Connection pool: `new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 })` — ініціалізується поза handler для reuse між invocations
- Network access: `0.0.0.0/0` з TLS (прийнятно для internal tool; URI захищено SSM)
- DB user права: `readWrite` на `users`, `topics`, `audit_log`
- Audit log: append-only за конвенцією — DELETE route для audit_log не реалізується

**CSV Processing (ADR-001):**
- Client-side: Papa Parse → preview 3 рядків → надсилає JSON payload
- Server-side: validate JSON schema (не parses raw CSV)

### Authentication & Security

**JWT:**
- Cookie: `httpOnly; Secure; SameSite=None` — обов'язково через cross-origin
- Термін: 24h
- Secret: AWS SSM Parameter Store `/lit/jwt-secret` SecureString
- CORS: `Access-Control-Allow-Origin: https://[exact-CF-Pages-domain]` + `Access-Control-Allow-Credentials: true`

**Secrets Management:**
- MongoDB URI: SSM `/lit/mongodb-uri` SecureString
- JWT Secret: SSM `/lit/jwt-secret` SecureString
- Lambda IAM role: `ssm:GetParameter` + `kms:Decrypt` тільки на `/lit/*` parameters

**Account Lockout:**
- 5 невдалих спроб → `locked_until = now + 15хв` (per-email, atomic `$inc/$set` на users document)
- API Gateway throttling ≤10 req/хв per IP — захист від масового lockout DoS

**Auth Hardening:**
- Однакова відповідь для "email не знайдено" і "пароль невірний": `"Невірний email або пароль"`
- При невідомому email — виконувати `bcrypt.compare(password, DUMMY_HASH)` для нівелювання timing attack
- Role middleware централізований: `requireRole('admin')` guard на всі `/admin/*` маршрути

**Password Generation:**
- `crypto.randomBytes(8).toString('base64url')` → ~11 символів
- `POST /admin/users/:id/reset-password` → повертає `{ newPassword }` один раз в response; зберігається тільки bcrypt hash

### API & Communication

**Error Response Standard (ADR-003):**
```json
{ "error": "TOPIC_ALREADY_TAKEN", "message": "Цю тему щойно вибрав інший учень" }
```
HTTP status: 400 bad request · 401 unauthorized · 403 forbidden · 409 conflict · 500 server error

**Health endpoint:** `GET /health` → `{ "status": "ok" }` — мінімальна відповідь без stack info

**API Contract:**

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /auth/login | — | Sets httpOnly cookie |
| POST | /auth/logout | student/admin | Clears cookie |
| GET | /topics | student | Тільки вільні теми |
| POST | /topics/:id/select | student | 409 якщо зайнята |
| GET | /admin/topics | admin | Всі теми з selected_by |
| POST | /admin/topics | admin | Додати тему |
| POST | /admin/topics/bulk | admin | CSV bulk import |
| DELETE | /admin/topics/:id | admin | Видалити тему (FR22) |
| POST | /admin/topics/:id/release | admin | Звільнити тему (FR24) |
| GET | /admin/users | admin | Список студентів |
| POST | /admin/users | admin | Додати студента |
| POST | /admin/users/bulk | admin | CSV bulk import |
| DELETE | /admin/users/:id | admin | Видалити студента (FR17) |
| POST | /admin/users/:id/reset-password | admin | Returns `{ newPassword }` |
| GET | /admin/export/status | admin | CSV stream: `title,description,supervisor,department,studentName,studentEmail,status` |
| GET | /admin/export/audit | admin | CSV stream |
| GET | /health | — | `{ status: "ok" }` |

### Frontend Architecture

**State Management:** TanStack Query v5
- `invalidateQueries(['topics'])` після будь-якого select response (success або 409)

**Routing:** React Router v7
- `/login` — публічна
- `/topics` — protected (student)
- `/admin/*` — protected (admin)

**API Client:** fetch wrapper з `credentials: 'include'` global default

### Infrastructure & Deployment

**Lambda (ADR-002):** Один monolith handler, `nodejs24.x`, ESM (`"type": "module"`)

**Terraform State:** Terraform Cloud free tier (до 500 ресурсів, без S3 backend)

**Deployment:** `terraform apply` з локалки
- `.gitignore`: `*.tfstate`, `*.tfstate.backup`, `.env`

### Decision Impact Analysis

**Implementation Sequence:**
1. MongoDB Atlas M0 cluster + DB user (`readWrite` на всі 3 collections)
2. Terraform Cloud workspace init
3. SSM Parameter Store: `/lit/mongodb-uri`, `/lit/jwt-secret`
4. Backend: Lambda monolith scaffold → auth middleware → role middleware → audit middleware
5. Frontend: Vite + shadcn/ui + TanStack Query + React Router
6. API endpoints: auth → topics → admin → export

**Cross-Component Dependencies:**
- SSM secrets потрібні до першого Lambda deploy
- MongoDB Atlas cluster потрібен до будь-якого backend тестування
- Cloudflare Pages URL потрібен для фінального CORS config і SameSite=None cookie domain

## Implementation Patterns & Consistency Rules

### Naming Patterns

**MongoDB:** collections — plural lowercase (`users`, `topics`, `audit_log`); fields — camelCase (`selectedBy`, `createdAt`, `lockedUntil`)

**API endpoints:** plural, kebab-case (`/admin/topics`, `/admin/export/status`); params — `:id`

**Frontend files:** Components/Pages — PascalCase `.tsx`; hooks — `use` prefix camelCase `.ts`; utils — camelCase `.ts`

**Backend files:** camelCase `.mjs` (`auth.mjs`, `requireAuth.mjs`, `db.mjs`)

### Format Patterns

**Success response:** прямий об'єкт або масив, без wrapper

**Error response:** `{ "error": "SNAKE_UPPER_CASE", "message": "Людський текст" }` + HTTP status

**`_id` → `id`:** ЗАВЖДИ через централізований helper:
```js
// src/lib/db.mjs
export const mapId = (doc) => ({ ...doc, id: doc._id.toString(), _id: undefined })
```

**Дати:** ISO 8601 string (`"2026-02-18T10:00:00.000Z"`)

**JSON fields:** camelCase у всіх API responses

### Structure Patterns

**Backend routing:** route map pattern, не if-chain:
```js
const routes = {
  'GET /topics': getTopics,
  'POST /topics/:id/select': selectTopic,
}
```

**Handler file structure:** один файл на домен (`auth.mjs`, `topics.mjs`, `admin.mjs`)

**Tests:** co-located (`topics.test.mjs`, `TopicAccordionItem.test.tsx`)

### Process Patterns

**Auth:** ЗАВЖДИ `requireAuth(event)` middleware — ніколи inline JWT parsing

**Audit:** ЗАВЖДИ `await logAudit(db, {...})` після кожної state-changing операції

**Error handling:** try/catch в кожному handler → `respond(statusCode, { error, message })`

**TanStack Query:** `invalidateQueries(['topics'])` і на success, і на error після select

### Enforcement Rules

**AI Agents MUST:**
1. Використовувати `mapId()` для всіх MongoDB documents в responses
2. Використовувати `requireAuth` / `requireRole` middleware — ніколи inline
3. Викликати `logAudit` після кожної state-changing операції
4. Route map pattern для handler routing
5. camelCase для MongoDB fields і API JSON responses

**AI Agents MUST NOT:**
1. Повертати `_id` напряму в responses
2. Зберігати JWT в localStorage
3. Додавати DELETE endpoint для `audit_log`
4. Логувати credentials або secrets
5. Використовувати `SameSite=Strict` — обов'язково `SameSite=None; Secure`

## Project Structure & Boundaries

### Complete Project Directory Structure

```
lit/
├── README.md
├── .gitignore                    # *.tfstate, *.tfstate.backup, .env, node_modules
│
├── frontend/                     # React + Vite + TypeScript + shadcn/ui
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── components.json           # shadcn/ui config
│   ├── .env.example              # VITE_API_URL=
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx               # Router + QueryClient setup
│       ├── globals.css           # Tailwind + CSS variables (#B436F0 palette)
│       ├── lib/
│       │   └── api.ts            # fetch wrapper (credentials: 'include')
│       ├── components/
│       │   ├── ui/               # shadcn/ui (не редагувати вручну)
│       │   │   ├── accordion.tsx
│       │   │   ├── button.tsx
│       │   │   ├── dialog.tsx
│       │   │   ├── input.tsx
│       │   │   ├── table.tsx
│       │   │   ├── badge.tsx
│       │   │   └── progress.tsx
│       │   ├── TopicAccordionItem.tsx    # FR7, FR8
│       │   ├── TopicConfirmDialog.tsx    # FR9, FR10, FR11
│       │   ├── TopicConfirmedScreen.tsx  # FR12, FR15
│       │   ├── RaceConditionAlert.tsx    # FR11
│       │   ├── AdminSidebar.tsx
│       │   └── AdminStatCard.tsx         # FR25
│       ├── pages/
│       │   ├── LoginPage.tsx             # FR1, FR2
│       │   ├── TopicsPage.tsx            # FR7–FR15
│       │   └── admin/
│       │       ├── AdminDashboardPage.tsx   # FR25
│       │       ├── AdminStudentsPage.tsx    # FR16–FR20
│       │       ├── AdminTopicsPage.tsx      # FR21–FR24
│       │       └── AdminAuditPage.tsx       # FR27, FR28
│       ├── hooks/
│       │   ├── useTopics.ts      # TanStack Query: GET /topics
│       │   ├── useSelectTopic.ts # TanStack Query: POST /topics/:id/select
│       │   ├── useAuth.ts        # login/logout mutations
│       │   └── useAdmin.ts       # admin queries/mutations
│       └── types/
│           └── api.ts            # TypeScript interfaces для API responses
│
├── backend/                      # Node.js ESM Lambda monolith
│   ├── package.json              # "type": "module"
│   ├── .env.example              # SSM_PARAM_MONGODB, SSM_PARAM_JWT
│   └── src/
│       ├── index.mjs             # Lambda handler entry point
│       ├── router.mjs            # Route map pattern
│       ├── handlers/
│       │   ├── auth.mjs          # FR1–FR6
│       │   ├── auth.test.mjs
│       │   ├── topics.mjs        # FR7–FR15
│       │   ├── topics.test.mjs
│       │   ├── admin.mjs         # FR16–FR28
│       │   ├── admin.test.mjs
│       │   └── health.mjs        # GET /health
│       ├── middleware/
│       │   ├── requireAuth.mjs
│       │   └── requireRole.mjs
│       └── lib/
│           ├── db.mjs            # MongoClient (maxPoolSize:5) + mapId()
│           ├── jwt.mjs
│           ├── bcrypt.mjs        # + DUMMY_HASH
│           ├── audit.mjs         # logAudit() cross-cutting helper
│           ├── ssm.mjs           # SSM Parameter Store reader
│           └── csv.mjs           # CSV stream formatter
│
└── infra/                        # Terraform
    ├── main.tf
    ├── variables.tf
    ├── outputs.tf
    ├── terraform.tf              # Terraform Cloud backend
    ├── lambda.tf
    ├── apigateway.tf             # HTTP API
    ├── iam.tf                    # Lambda role + SSM policy
    └── ssm.tf                    # mongodb-uri, jwt-secret parameters
```

### Requirements to Structure Mapping

| FR Group | Frontend | Backend |
|---|---|---|
| Auth (FR1–FR6) | LoginPage, useAuth | handlers/auth.mjs |
| Topics student (FR7–FR15) | TopicsPage, TopicAccordionItem, useTopics | handlers/topics.mjs |
| User mgmt (FR16–FR20) | AdminStudentsPage, useAdmin | handlers/admin.mjs |
| Topic mgmt (FR21–FR24) | AdminTopicsPage, useAdmin | handlers/admin.mjs |
| Reporting (FR25–FR28) | AdminDashboardPage, AdminAuditPage | handlers/admin.mjs |
| Audit (FR29–FR31) | — | lib/audit.mjs (cross-cutting) |

### Data Flow

```
Student request:
Browser → Cloudflare → API Gateway (throttling) → Lambda (requireAuth)
→ MongoDB findOneAndUpdate → logAudit → response

Admin CSV export:
Browser → API Gateway → Lambda (requireRole admin)
→ MongoDB find() → lib/csv.mjs stream → response
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
Всі технологічні рішення сумісні. `SameSite=None; Secure` коректний для cross-origin CF Pages ↔ API GW. `maxPoolSize: 5` безпечний для M0 (500 connections) при Lambda auto-scaling. ESM (`"type": "module"`) + nodejs24.x — нативна підтримка без транспайлу.

**Pattern Consistency:**
Route map pattern, централізований auth/role middleware та cross-cutting audit — взаємно підтримуються і не суперечать технічному стеку. `mapId()` + camelCase конвенції консистентні між MongoDB, API і frontend.

**Structure Alignment:**
Структура монорепо (frontend/backend/infra) відповідає рішенням. handlers/ per domain, lib/ для shared utilities, middleware/ ізольовано — дозволяє агентам незалежно реалізовувати домени без конфліктів.

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**
Всі 31 FR покриті архітектурними рішеннями через 6 доменів. Mapping FR → файл задокументований у таблиці "Requirements to Structure Mapping".

**Non-Functional Requirements Coverage:**
Всі 7 NFR (Free Tier, bcrypt, JWT cookie, rate limiting, atomic select, concurrency, cold start) мають конкретне архітектурне рішення.

### Implementation Readiness Validation ✅

**Decision Completeness:**
Критичні рішення задокументовані з конкретними параметрами (`maxPoolSize: 5`, cost: 10, `SameSite=None`, Terraform Cloud free tier). Frontend бібліотечні версії вказані (React Router v7, TanStack Query v5).

**Structure Completeness:**
Повне дерево директорій визначене аж до рівня файлів. Кожен файл mapped до конкретних FR.

**Pattern Completeness:**
Naming, format, structure і process patterns визначені з enforcement rules та MUST/MUST NOT списками для AI агентів.

### Gap Analysis Results

**GAP-1 (Important → Вирішено): `respond()` helper — розташування**
Функція `respond(statusCode, body)` визначається та реекспортується з `backend/src/router.mjs`. Всі handlers імпортують її:
```js
import { respond } from '../router.mjs'
```

**GAP-2 (Important → Вирішено): Критичні API response bodies**

| Endpoint | Response Shape |
|---|---|
| `POST /auth/login` | `{ id, email, role: "student"\|"admin", selectedTopic: { id, title, description, supervisor, department } \| null }` + httpOnly cookie |
| `POST /topics/:id/select` | `{ topic: { id, title, description, supervisor, department, selectedBy } }` або 409 `{ error, message }` |
| `POST /admin/users/bulk` | `{ created: number, errors: [{ row, message }] }` |
| `POST /admin/topics/bulk` | `{ created: number, errors: [{ row, message }] }` — CSV колонки: `title,description,supervisor,department` |
| `DELETE /admin/users/:id` | `204 No Content` |
| `DELETE /admin/topics/:id` | `204 No Content` |
| `POST /admin/topics/:id/release` | `{ topic: { id, title, description, supervisor, department, selectedBy: null } }` |
| `POST /admin/users/:id/reset-password` | `{ newPassword: string }` (один раз, не зберігається) |

**GAP-3 (Critical → Вирішено): Backend library versions**

```json
{
  "dependencies": {
    "mongodb": "^6.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "@aws-sdk/client-ssm": "^3.0.0"
  }
}
```

⚠️ `bcrypt` (native C++ bindings) — **ЗАБОРОНЕНО** в Lambda. Тільки `bcryptjs` (pure JS).

**GAP-4 (Minor → Вирішено): CORS_ORIGIN env var**
До отримання фінального CF Pages domain Lambda читає `process.env.CORS_ORIGIN`. Terraform SSM parameter `/lit/cors-origin` додати до `infra/ssm.tf`.

**GAP-5 (Minor → Вирішено): SSM singleton caching**

```js
// backend/src/lib/ssm.mjs
let cached = null;
export const getSecrets = async (client) => {
  if (cached) return cached;
  const [mongoUri, jwtSecret, corsOrigin] = await Promise.all([
    getParam(client, '/lit/mongodb-uri'),
    getParam(client, '/lit/jwt-secret'),
    getParam(client, '/lit/cors-origin'),
  ]);
  cached = { mongoUri, jwtSecret, corsOrigin };
  return cached;
};
```

Secrets читаються один раз при cold start, кешуються у module-level змінній.

### Доповнення до Enforcement Rules

**AI Agents MUST NOT:**
6. Використовувати пакет `bcrypt` (native C++ bindings) — тільки `bcryptjs@^2.4.3`
7. Повертати `newPassword` в audit log або будь-якому лозі

**AI Agents MUST:**
6. `respond()` — завжди `import { respond } from '../router.mjs'`, ніколи inline
7. `POST /auth/login` response — завжди `{ id, email, role, selectedTopic: { id, title, description, supervisor, department } | null }` + httpOnly cookie
8. `ssm.mjs` — singleton pattern (module-level cache), не читати SSM per invocation
9. `204 No Content` для DELETE endpoints — без response body

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Атомарний вибір теми через `findOneAndUpdate` — центральний ризик закритий
- `SameSite=None; Secure` вірно визначено для cross-origin сценарію
- Enforcement rules з MUST/MUST NOT — практично усувають agent conflicts
- Monolith Lambda знижує складність при 7-денному deadline
- Audit log як cross-cutting concern чітко описаний з `logAudit()` правилом
- `bcryptjs` (pure JS) явно вибрано для Lambda сумісності

**Areas for Future Enhancement:**
- TypeScript на backend (зараз deferred)
- Shared types між frontend і backend
- MFA для адміна
- Terraform remote state на S3 замість Terraform Cloud (якщо потрібен self-hosted)

### Implementation Handoff

**AI Agent Guidelines:**
- Слідуй всім архітектурним рішенням точно як задокументовано
- Використовуй implementation patterns консистентно по всіх компонентах
- Дотримуйся project structure і boundaries
- Звертайся до цього документу для всіх архітектурних питань

**First Implementation Priority:**
```bash
# Крок 1: ініціалізація монорепо
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npx shadcn@latest init

mkdir backend && cd backend && npm init -y
# встановити: mongodb jsonwebtoken bcryptjs @aws-sdk/client-ssm

# Крок 2: MongoDB Atlas M0 cluster + DB user (readWrite на users, topics, audit_log)
# Крок 3: Terraform Cloud workspace init
# Крок 4: SSM Parameter Store (/lit/mongodb-uri, /lit/jwt-secret, /lit/cors-origin)
```
