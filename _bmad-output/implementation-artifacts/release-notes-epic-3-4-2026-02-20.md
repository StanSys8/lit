# Release Notes: Epic 3 + Epic 4

Date: 2026-02-20
Version Scope: student topic flow + admin visibility/audit

## Included Stories

1. Story 3.2 — topic selection with confirmation and race-condition handling.
2. Story 3.3 — selected topic confirmation and relogin persistence.
3. Story 4.1 — admin dashboard topic-selection stats cards.
4. Story 4.2 — CSV export of topics status.
5. Story 4.3 — admin audit log view.
6. Story 4.4 — CSV export of audit log.

## Key User Impact

- Students now receive explicit and robust feedback during topic selection.
- Students who already selected a topic see a persistent confirmed state after relogin.
- Admins can monitor selection progress in real time.
- Admins can export operational status and audit trails to CSV for reporting.

## Operational Notes

- Audit actions now include: `SELECT_TOPIC`, `EXPORT_STATUS`, `EXPORT_AUDIT` in active flows.
- API and UI paths for status/audit exports are fully integrated.
