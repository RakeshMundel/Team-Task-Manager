# Team Task Manager

A MERN-style team task manager with a React frontend, Express REST API, MySQL database, JWT authentication, projects, members, task assignment, dashboards, and role-based access control.

## Live Demo

[Open the deployed app on Railway](https://task-manager-app-production-1be3.up.railway.app)

## Stack

- React + Vite frontend in `frontend/`
- Node.js + Express backend in `backend/`
- MySQL database
- JWT authentication
- Railway-ready deployment config

## Project Structure

```text
backend/
  src/
    db.js
    migrate.js
    server.js
frontend/
  src/
    main.jsx
    styles.css
  index.html
  vite.config.js
```

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and set `DATABASE_URL`, `JWT_SECRET`, and `PORT`.

3. Run migrations:

   ```bash
   npm run migrate
   ```

4. Start the backend:

   ```bash
   npm run dev
   ```

5. In another terminal, start the React frontend:

   ```bash
   npm run frontend
   ```

The React app runs at `http://localhost:5173` and proxies API calls to the backend.

## Production Run

```bash
npm run build
npm run migrate
npm start
```

The backend serves the built React app from `frontend/dist`.
