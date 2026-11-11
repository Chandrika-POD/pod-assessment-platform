# Code organization

This is a single repository with two npm workspaces: `frontend` and `backend`. Install dependencies once at the project root. The root lockfile records the dependency versions for both workspaces.

## Frontend responsibilities

- `src/main.jsx` mounts React and imports global styles.
- `src/app/App.jsx` coordinates the selected patient, current screen, loading, and saved results.
- `src/components/layout/` contains the application shell and sidebar.
- `src/components/ui/` contains reusable interface primitives such as the dialog.
- `src/features/patients/` owns the patient list, details, and Add Patient form.
- `src/features/assessments/gad7/` owns the GAD-7 questionnaire.
- `src/features/assessments/components/` contains assessment history and score display.
- `src/api/http.js` handles JSON requests and HTTP errors.
- `src/api/patients.js` provides named API operations; components do not build endpoint URLs themselves.
- `src/lib/formatters.js` formats dates, ages, and patient initials.

Keep state close to the feature that owns it. Shared patient selection and navigation belong in `App`; search and pagination belong in the patient list; answers and save progress belong in the questionnaire.

## Backend responsibilities

`src/index.js` starts the server. `src/app.js` composes middleware, health checks, and API modules. The backend serves JSON on port `4100`, including its root URL, and never serves frontend files. During development, Vite serves the frontend on port `5173` and proxies `/api` requests to the backend.

Each feature module lives under `src/modules/`:

| File              | Responsibility                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `*.routes.js`     | Map HTTP paths to handlers and wire dependencies                                          |
| `*.schemas.js`    | Validate request data with Zod                                                            |
| `*.controller.js` | Read requests, call the feature operation, and send responses                             |
| `*.service.js`    | Business rules that need multiple operations, such as scoring and safe submission retries |
| `*.repository.js` | Parameterized PostgreSQL queries                                                          |

The patients module is simple enough for its controller to call repositories directly. Assessment submissions have a service because they combine patient lookup, scoring, persistence, and duplicate detection. Add a patient service when patient business rules need one.

Database connections are created in `src/db/client.js` and passed into modules. Tests pass a pool scoped to a temporary database schema, so normal patient records are not modified.

## Database files and scripts

- `src/db/migrations/001_initial.sql` defines the current schema and integrity constraints.
- `src/db/seeds/patients.js` contains the six dummy patient fixtures.
- `scripts/setup-db.js` creates the database if missing, applies the initial schema, and seeds patients in a transaction.
- `scripts/local-postgres.js` manages the project PostgreSQL instance, keeping its data in the root `.postgres/` folder.

Setup currently supports the initial schema only; it is not a version-tracking migration framework. Before changing an existing table, add an explicit ordered migration and extend the runner to track applied migrations. Changing `CREATE TABLE IF NOT EXISTS` will not update a table that already exists.

## Adding another assessment

1. Add instrument definitions under `shared/assessments/` and their scoring tests under `backend/tests/`.
2. Add the questionnaire UI under `frontend/src/features/assessments/<instrument>/`.
3. Add backend request validation and scoring dispatch for the instrument.
4. Add a database migration for its storage contract. Current constraints intentionally accept only `GAD-7-v1`, exactly seven answers, and its scoring rules; they must be extended deliberately for another instrument.
5. Update the available-assessment selection and history rendering to use the saved instrument version. The current history renderer is specific to GAD-7.
6. Run API/scoring tests, the frontend build, and the relevant browser workflow checks.

The `shared/` folder must contain only browser-safe instrument definitions and calculations. Credentials, database access, and server configuration stay in the backend. The root `.env` supplies local configuration; only explicitly prefixed `VITE_` variables are exposed by Vite to browser code, so never give secrets that prefix.
