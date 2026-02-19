# Story 1.2: Зовнішні сервіси та перший деплой

Status: ready-for-dev

## Story

As a developer,  
I want all external services configured and the Lambda deployed,  
so that the backend API is reachable and ready for feature development.

## Acceptance Criteria

1. **Given** MongoDB Atlas cluster і SSM `/lit/mongodb-uri`,  
   **When** Lambda cold start викликає `getSecrets()` з `ssm.mjs`,  
   **Then** secrets кешуються у module-level змінній — жодного SSM API call при повторних invocations.
2. **Given** задеплоєна Lambda,  
   **When** `GET /health`,  
   **Then** відповідь `{"status":"ok"}` зі статусом 200.
3. **Given** API Gateway URL і `CORS_ORIGIN` (значення з SSM `/lit/cors-origin`),  
   **When** CORS preflight `OPTIONS` запит із відповідного origin,  
   **Then** відповідь містить `Access-Control-Allow-Origin: <origin>` і `Access-Control-Allow-Credentials: true`.

## Tasks / Subtasks

- [ ] Підготувати зовнішні сервіси (manual only) (AC: 1, 2, 3)
  - [ ] Створити MongoDB Atlas M0 cluster + DB user (`readWrite` на `users`, `topics`, `audit_log`)
  - [ ] Ініціалізувати Terraform Cloud workspace (`terraform login` + `terraform init`)
  - [ ] Заповнити AWS SSM Parameter Store: `/lit/mongodb-uri`, `/lit/jwt-secret`, `/lit/cors-origin`
  - [ ] Виконати `terraform apply` для підняття Lambda + API Gateway
- [ ] Верифікувати деплой (AC: 1, 2, 3)
  - [ ] Перевірити `GET /health` = HTTP 200 + `{"status":"ok"}`
  - [ ] Перевірити CORS preflight для фронтенд-origin
  - [ ] Перевірити, що `getSecrets()` читає SSM один раз на cold start (кешування працює)
- [ ] Зафіксувати докази виконання
  - [ ] Додати в Dev Agent Record команди, результати і endpoints/ARNs
  - [ ] Оновити File List (усі змінені/створені файли)

## Dev Notes

- Ця story виконується розробником вручну (cloud console/CLI/IaC кроки).
- Агент не повинен самостійно виконувати деструктивні/зовнішні cloud-операції без прямої команди користувача.
- Використовувати вже узгоджені рішення з `architecture.md`:
  - Terraform як єдиний IaC-шар
  - Secrets у SSM (`/lit/*`)
  - Lambda runtime `nodejs24.x`
  - CORS тільки для точного frontend origin

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.2: Зовнішні сервіси та перший деплой`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#Infrastructure & Deployment`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#Authentication & Security`]

## Dev Agent Record

### Agent Model Used

gpt-5-codex

### Debug Log References

- Story generated from Epic 1 Story 1.2.
- This is a manual-only infrastructure story; execution steps are intentionally left unchecked.

### Completion Notes List

- Story scaffold created and marked `ready-for-dev`.

### File List

- _bmad-output/implementation-artifacts/1-2-external-services-and-first-deploy.md
