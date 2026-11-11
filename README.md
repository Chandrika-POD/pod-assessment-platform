# POD Assessment Platform

The assessment database app lives in [`assessment-database/`](assessment-database/README.md). It includes a React frontend, an Express API, PostgreSQL storage, and a GAD-7 assessment workflow with fictional patient fixtures.

## Local setup

Requires Node.js 22.12+ and PostgreSQL server binaries. From the repository root:

```bash
cd assessment-database
npm install
cp .env.example .env # First setup only; preserve an existing .env.
npm run db:local:start
npm run db:setup
npm run dev
```

Open http://localhost:5173. The API runs at http://127.0.0.1:4100.

See the [app README](assessment-database/README.md) for Docker setup, tests, API details, and limitations. This local prototype has no authentication and uses fictional seed data.

Local `.env` files, installed dependencies, PostgreSQL data, and generated artifacts are excluded from Git. The URL extraction tool is maintained separately and is not included here.
