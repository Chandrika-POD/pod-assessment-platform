# Browse the assessment database in DBeaver

DBeaver is a visual client for the existing PostgreSQL server. It connects directly to the same `assessment_db` used by the backend. You do not need to create another database or move any data.

## 1. Start PostgreSQL

```bash
cd pod-assessment-platform/assessment-database
npm run db:local:start
```

The frontend and backend do not need to be running to browse existing records in DBeaver. PostgreSQL does need to be running. Start the app with `npm run dev` when you want to submit new assessments through the UI.

## 2. Add a PostgreSQL connection

In DBeaver, choose **Database → New Database Connection**, select **PostgreSQL**, and enter:

| Field           | Value                      |
| --------------- | -------------------------- |
| Connection name | OpenMind Local Assessments |
| Host            | `127.0.0.1`                |
| Port            | `55432`                    |
| Database        | `assessment_db`            |
| Authentication  | Database username/password |
| Username        | `assessment`               |
| Password        | `assessment_local`         |

Use a direct local connection, with no SSH tunnel or required SSL. If DBeaver asks for the PostgreSQL JDBC driver, allow it to download the driver. Choose **Test Connection**, then **Finish** after the test succeeds.

These settings assume DBeaver is running on the same machine as this PostgreSQL instance. The database only listens on this machine's loopback interface.

Official reference: [DBeaver connection wizard](https://dbeaver.com/docs/dbeaver/Create-Connection/).

## 3. Browse tables

Expand the connection in Database Navigator, then expand the database if shown, **Schemas → public → Tables**. Open a table and select its **Data** tab.

- `patients`: six seeded patients plus any patients you add.
- `assessments`: saved answers and results. This table can be empty until you complete an assessment.

The `assessments.patient_id` foreign key references `patients.id`. A patient can have multiple assessments. The `answers` column is a PostgreSQL integer array; its seven positions correspond to the questions in order.

After saving a form in the app, refresh the table's data in DBeaver to see the new row. To see names alongside scores, open [queries.sql](queries.sql) in DBeaver's SQL editor and run the joined report query against this connection.

## Troubleshooting

- **Connection refused:** start PostgreSQL with `npm run db:local:start`; check that the port is `55432`, not the default `5432`.
- **Authentication failed:** use the credentials above, or the credentials in your root `.env` if you changed the database configuration.
- **Database does not exist:** run `npm run db:setup` from the project root.
- **No tables visible:** check that the selected database is `assessment_db` and the schema is `public`, then refresh the navigator.
- **Data does not update:** refresh the Data tab after saving the assessment. DBeaver does not automatically refresh on every application write.

Stopping PostgreSQL with `npm run db:local:stop` disconnects both DBeaver and the app. It preserves the data in `.postgres/data`.
