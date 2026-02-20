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
