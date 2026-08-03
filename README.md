# Smart Farmer Market

Smart Farmer Market is now a monorepo with a **NestJS backend**, **Next.js web app**, and **Expo mobile app**.

## Stack

- `apps/api` - NestJS + Mongoose API
- `apps/web` - Next.js web app
- `apps/mobile` - Expo mobile shell that loads the web app in a WebView
- `apps/api-django-legacy` - old Django backend kept only as reference

## Requirements

- Node.js 20.19+
- MongoDB running locally on `mongodb://127.0.0.1:27017`
- Expo Go on your phone if you want to test mobile on a real device

## MongoDB

Make sure MongoDB is started before running the API or seed commands.

Default local connection:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_NAME=smart_farmer
```

## 1) Install

### Bash

```bash
cp .env.example .env
cp -n apps/mobile/.env.example apps/mobile/.env
npm install --workspaces --include-workspace-root
```

### PowerShell

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
Copy-Item apps/mobile/.env.example apps/mobile/.env -ErrorAction SilentlyContinue
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm install --workspaces --include-workspace-root
```

## 2) Start everything

Open **3 terminals** from the repo root.

### Terminal 1 - API

```bash
npm run dev:api
```

### Terminal 2 - Web

```bash
npm run dev:web
```

### Terminal 3 - Mobile

```bash
npm run dev:mobile:clear
```

## Seed test users

After MongoDB is running and dependencies are installed, seed local test accounts with:

```bash
npm run seed:test-users
```

This creates or updates these users:

- `admin@test.local` / `AdminPass#2026`
- `farmer@test.local` / `FarmerPass#2026`
- `customer@test.local` / `CustomerPass#2026`

## 3) Open the app

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- Health check: `http://localhost:8000/health`

## Default local env

Root `.env` already points to local MongoDB:

```env
API_PORT=8000
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_NAME=smart_farmer
NEXT_API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Optional admin login

Set these in `.env` if you want the admin account to be auto-created on API startup:

```env
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD="AdminPass#2026"
ADMIN_USERNAME=admin
ADMIN_FULL_NAME=System Administrator
```

## OTP / email notes

For local testing, this is already enabled in `.env.example`:

```env
MAIL_SUPPRESS_SEND=true
EXPOSE_TEST_OTP=true
```

That means:
- the API will not send real emails
- OTP values are returned in the API response for local development

When you want real email delivery, update `.env` like this:

```env
MAIL_SUPPRESS_SEND=false
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=your-email@gmail.com
EXPOSE_TEST_OTP=false
```

## Real phone setup with Expo Go

If you are testing on a real phone:

1. Start API
2. Start web
3. Start Expo
4. Scan the QR code with Expo Go

If Expo does not detect the correct LAN URL, set `apps/mobile/.env` manually:

```env
EXPO_PUBLIC_WEB_URL=http://YOUR_COMPUTER_IP:3000
```

Then restart Expo.

## Useful commands

```bash
npm run typecheck:api
npm run typecheck:web
npm run build:api
npm run build:web
```

## Notes

- The frontend API routes were kept the same, so the web and mobile apps can keep using the same backend URLs.
- Uploaded crop images are served from `/media/uploads/...`.
- The old Django backend is archived in `apps/api-django-legacy` in case you want to compare logic during migration.
