# LeaderMath.UZ — Rebuild (Netlify Functions + Netlify Blobs)

## Quick start
1) Install Netlify CLI:
   npm i -g netlify-cli

2) Run locally:
   npm install
   netlify dev

3) Open:
   - http://localhost:8888  (index.html)
   - http://localhost:8888/admin.html

## Environment variables (recommended)
Create `.env` (or set in Netlify UI):
- ADMIN_KEY=LEADERMATH_SUPER_2026
- TOKEN_SECRET=change-me-to-random-long-string

If not set, dev defaults are used (works locally, but set them for production).

## What’s inside
- Auto register: one tap -> ID + password generated on server
- Login: ID + password -> signed token
- App: banners carousel + cards + bottom nav (scrollable)
- Admin: content editor + users list (points/balance)
- Storage: Netlify Blobs (works on Netlify + netlify dev)


## If you see MissingBlobsEnvironmentError on Netlify
If Netlify Blobs is not enabled for your site, the project will fall back to in-memory storage (not persistent).
To force persistent storage, set env vars:
- BLOBS_SITE_ID=<your Netlify site id>
- BLOBS_TOKEN=<Netlify Personal Access Token>
Or enable Blobs in Netlify UI (Project -> Blobs).
