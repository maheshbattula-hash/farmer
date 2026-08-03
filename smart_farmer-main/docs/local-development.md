# Local development

## Quick start

### Bash

```bash
cp .env.example .env
cp -n apps/mobile/.env.example apps/mobile/.env
npm install --workspaces --include-workspace-root
npm run dev:api
npm run dev:web
npm run dev:mobile:clear
```

### PowerShell

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
Copy-Item apps/mobile/.env.example apps/mobile/.env -ErrorAction SilentlyContinue
npm install --workspaces --include-workspace-root
npm run dev:api
npm run dev:web
npm run dev:mobile:clear
```

## Services

- API: `http://localhost:8000`
- Web: `http://localhost:3000`
- API health: `http://localhost:8000/health`

## MongoDB

Make sure MongoDB is running locally:

```bash
mongodb://127.0.0.1:27017
```

## Typecheck and build

```bash
npm run typecheck:api
npm run typecheck:web
npm run build:api
npm run build:web
```
