# Architecture

## Monorepo layout

- `apps/api` contains the NestJS API.
- `apps/web` contains the Next.js web experience.
- `apps/mobile` contains the Expo shell that opens the web app in a WebView.
- `apps/api-django-legacy` contains the previous Django backend for reference only.
- `docs` contains project notes.
- `scripts` contains bootstrap helpers.

## Runtime flow

1. The browser and mobile shell talk to the NestJS API on port `8000`.
2. The Next.js app renders templates and manages auth/session state through cookies.
3. The Expo app resolves the LAN URL for the Next.js app, checks `/healthz`, and then mounts the WebView.

## Backend notes

- The API uses NestJS controllers, services, and modules.
- MongoDB is the default database.
- Mongoose models are used for users, crops, orders, reviews, OTP challenges, and auth tokens.
- Uploaded files are stored under `apps/api/media/uploads` and served at `/media/uploads/...`.
