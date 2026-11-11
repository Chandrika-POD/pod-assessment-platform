# OpenMind assessment database

A standalone local app built with React + Vite, Node.js + Express, and PostgreSQL. No authentication is included. The existing POD frontend and backend are separate and are not required to run this app.

## Start on this machine

Requires Node.js 22.12+ and the installed PostgreSQL server binaries. This repository uses npm workspaces: one root install manages `frontend/` and `backend/`. From this folder:

```bash
npm install
cp .env.example .env # only on first setup; preserve your existing .env
npm run db:local:start
npm run db:setup
npm run dev
```

Open http://localhost:5173. The API runs at http://127.0.0.1:4100.

`db:local:start` creates a separate PostgreSQL cluster in `.postgres/data`, with local development user `assessment`, password `assessment_local`, and port `55432`. It binds only to localhost and does not change the system PostgreSQL service. `db:setup` creates `assessment_db`, creates the tables, and seeds six fictional patients. Running it again preserves patient records and assessment history. No manual database creation is required with this setup. Stop the project database with `npm run db:local:stop`; data is retained.

## Alternative database setups

**Docker:** instead of `db:local:start`, run `docker compose up -d --wait`, then `npm run db:setup`. The same `.env.example` works. Do not run both database options at once: both use port 55432. `docker compose down` stops the container and keeps the named data volume.

**Existing PostgreSQL:** set `DATABASE_URL` in `.env` to your chosen PostgreSQL user, password, host, port, and database. `npm run db:setup` requires a role that can connect to the `postgres` maintenance database and create the target database if missing. If the role cannot create databases, create the empty target database yourself first; setup can then create its tables and seed the patients.

## Workflow

1. Open Patient Assessments & Tests → GAD-7 Assessment → Assess Patients.
2. Search or paginate through the six dummy patients, or use Add Patient.
3. Click a patient to see demographics and assessment history.
4. Click Start GAD-7 and answer all seven questions.
5. Save the assessment. The API validates answers, calculates the score, and saves the result against that patient's ID.
6. Review the saved score and expand the history entry to see every answer. Results survive a browser refresh and server restart.

View Test Reports opens the patient list with latest result summaries; open a patient to see all their reports. Other sidebar sections are labelled as future features.

## Scoring and instrument source

Uses the standard seven GAD-7 items with four response choices scored 0–3, referring to the past two weeks. Total score is 0–21; symptom bands are Minimal (0–4), Mild (5–9), Moderate (10–14), and Severe (15–21). These are screening results, not diagnoses. No percentiles or diagnostic probabilities are calculated.

- Reference and scoring: https://novopsych.com/assessments/anxiety/generalised-anxiety-disorder-assessment-gad-7/
- Questionnaire: https://novopsych.com/wp-content/uploads/2023/03/Generalised-Anxiety-Disorder-Assessment-GAD-7.pdf
- Instrument: Spitzer, R. L., Kroenke, K., Williams, J. B., & Löwe, B. (2006), https://doi.org/10.1001/archinte.166.10.1092
- GAD-7 reproduction guidance: https://www.corc.uk.net/outcome-measures-guidance/directory-of-outcome-measures/generalised-anxiety-disorder-assessment-gad-7/

## Data and API

- `patients`: UUID, name, date of birth, gender, email, creation time.
- `assessments`: UUID, patient foreign key, instrument version, seven integer answers, score, severity, completion timestamp.
- Patient summaries derive the latest assessment from saved history. Each completed assessment adds a record rather than overwriting past answers.
- The API calculates scores; supplied client scores are rejected. Database constraints also enforce answer range, score consistency, and severity.
- A submission UUID prevents retries from creating duplicate results.

| Endpoint                             | Purpose                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| `GET /api/health`                    | PostgreSQL connectivity                                       |
| `GET /api/patients`                  | Patients and latest assessment summary                        |
| `POST /api/patients`                 | Create a patient: `name`, `dateOfBirth`, `gender`, `email`    |
| `GET /api/patients/:id`              | Patient details and full assessment history                   |
| `POST /api/patients/:id/assessments` | Save `{ "submissionId": "UUID", "answers": [0,1,2,3,0,1,2] }` |

## Checks and production build

With PostgreSQL running and the database initialized:

```bash
npm test
npm run build
npm run test:e2e
```

Backend API tests use an isolated temporary PostgreSQL schema and remove it afterwards. Browser tests create and remove their own patient record. Playwright needs Chromium; if missing, run `npx playwright install chromium`. Screenshots are written to `artifacts/`.

`npm start` starts only the backend API at http://127.0.0.1:4100. Its root URL returns JSON identifying the API. Use `npm run dev:client` for the frontend at http://localhost:5173; Vite forwards `/api` requests to the backend. `npm run build` generates the frontend files for separate hosting; the backend does not serve those files.

This prototype uses dummy data and has no access controls, as requested. Keep it local until authentication and deployment configuration are added for real patient use. The font optionally loads from Google Fonts and falls back to system fonts offline.

## Structure

```text
assessment-database/
├── frontend/
│   ├── src/
│   │   ├── app/                 App state and screen orchestration
│   │   ├── api/                 HTTP client and patient API calls
│   │   ├── components/
│   │   │   ├── layout/          App shell and sidebar
│   │   │   └── ui/              Reusable dialog
│   │   ├── features/
│   │   │   ├── patients/        Patient pages and Add Patient component
│   │   │   └── assessments/     GAD-7 form, score badge, and history
│   │   ├── lib/                 Date, age, and name formatting
│   │   └── styles/              Responsive application styles
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── config/              Environment configuration
│   │   ├── db/
│   │   │   ├── migrations/      Database schema SQL
│   │   │   └── seeds/           Dummy patient fixtures
│   │   ├── middleware/          HTTP errors and request error handling
│   │   ├── modules/
│   │   │   ├── patients/        Routes, controller, validation, SQL queries
│   │   │   └── assessments/     Routes, controller, validation, service, SQL queries
│   │   ├── app.js               Express app composition
│   │   └── index.js             Server startup and shutdown
│   ├── scripts/                PostgreSQL lifecycle and database setup
│   ├── tests/                  API persistence and scoring tests
│   └── package.json
├── shared/assessments/          GAD-7 questions, options, and scoring
├── tests/e2e/                  Browser workflow checks
├── docs/                       Architecture and DBeaver instructions
├── .postgres/                  Existing local database data (ignored by Git)
├── .env                        Local connection settings (ignored by Git)
├── compose.yaml                Optional Docker PostgreSQL service
└── package.json                Workspace orchestration and common commands
```

The `.postgres/` data directory remains at the project root. Refactoring the source folders does not recreate the database or change saved patient records.

## Manual frontend and backend startup

From the project root, start PostgreSQL once:

```bash
npm run db:local:start
```

Then use two terminals:

```bash
# Terminal 1, from the project root:
npm run dev:server

# Terminal 2, from the project root:
npm run dev:client
```

Alternatively, run `npm run dev` from the root to start both. You can also run `npm run dev` directly inside `backend/` or `frontend/`. The backend loads the root `.env`; Vite loads its configuration from that same root. Frontend source does not receive the database connection string.

The frontend builds into `frontend/dist/`. That output is separate from the backend and must be served by a frontend host when deploying. Port `4100` remains API-only even when a frontend build exists.

Run `npm run format` to format source files, or `npm run format:check` to check formatting.

## DBeaver and future development

- [Connect DBeaver and browse patient records](docs/dbeaver.md)
- [Code organization and adding features](docs/architecture.md)
- [Read-only queries to open in DBeaver](docs/queries.sql)
