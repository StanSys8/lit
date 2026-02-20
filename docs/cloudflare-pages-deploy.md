# Cloudflare Pages Deploy

## Required Settings

- Framework preset: `Vite`
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`

If your Pages project uses repository root as root directory:

- Build command: `cd frontend && npm run build`
- Build output directory: `frontend/dist`

## Symptom: "Page without styles"

Root cause in this project is usually that Cloudflare serves `frontend/index.html` (dev entry `/src/main.tsx`) instead of built `frontend/dist/index.html` (contains `/assets/*.css`).

Verify after deploy:

1. Open page source and check there is a stylesheet link to `/assets/index-*.css`.
2. In browser Network tab, ensure that CSS request returns `200`, not `404`.

## Symptom: `POST /auth/login` returns `405`

If login request goes to:

- `https://lit-bvd.pages.dev/auth/login`

then frontend is calling Pages static host, not API Gateway.

Expected request target:

- `https://58r8t1adkk.execute-api.eu-central-1.amazonaws.com/auth/login`

### Checklist

1. Ensure `VITE_API_BASE_URL` is set for **Production** and **Preview**:
   - `https://58r8t1adkk.execute-api.eu-central-1.amazonaws.com`
2. Trigger a **new deployment** (prefer `Clear build cache`).
3. Confirm Production alias points to the latest deployment commit.
4. Verify in browser Network that `POST /auth/login` uses `execute-api` host.

### Code-level safeguard (already implemented)

`frontend/src/apiBase.ts` includes a runtime fallback for `*.pages.dev` hosts:

- if `VITE_API_BASE_URL` is missing in built assets, API base falls back to:
  - `https://58r8t1adkk.execute-api.eu-central-1.amazonaws.com`

This prevents silent fallback to relative `/auth/login` on Pages.
