# Team Nova

Monorepo with a NestJS API and a React Native (Expo) mobile app.

```
backend/   NestJS + TypeScript API
frontend/  React Native (Expo) + TypeScript app
```

## Backend

```bash
cd backend
npm install
cp .env.example .env
npm run start:dev
```

API runs on `http://localhost:3000/api` — health check at `/api/health`.

## Frontend

```bash
cd frontend
npm install
npm start
```

Copy `frontend/.env.example` to `frontend/.env` and set `EXPO_PUBLIC_API_URL` to point at the backend
(use your machine's LAN IP when running on a physical device).
