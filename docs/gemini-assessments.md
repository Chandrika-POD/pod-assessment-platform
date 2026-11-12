# GAD-7 conversations and JSON definitions

## Configure and run

The root `.env` already holds the local database settings. Add your key there without changing `DATABASE_URL`:

```dotenv
GEMINI_API_KEY=your_key_here
GEMINI_LIVE_MODEL=gemini-3.8-live
APP_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

`GEMINI_API_KEY` must never have a `VITE_` prefix. The key is read only by the backend. `.env` is ignored; `.env.example` contains an empty placeholder. Model availability and quota depend on your Gemini account; `GEMINI_LIVE_MODEL` can be changed to another compatible Live audio model.

From the repository root:

```bash
npm install
npm run db:local:start
npm run db:setup
npm run dev
```

Open a patient, select **Start conversation**, read the data-sharing notice, and choose **Start with text** or **Start with voice**. Microphone access needs localhost or HTTPS. Text mode does not request microphone permission. Voice mode supports interruption, mute, typed input, and on-screen responses. The model asks one fixed question at a time. Confirm its proposed response or choose a different response yourself. After all seven, correct any answers in the review and save.

The backend runs repeatable migrations at startup and during `db:setup`. Existing patient records and assessment history are preserved. Restart the backend after changing `.env`.

## Data flow and persistence

- `shared/assessments/gad7.json` defines wording, options, reference period, scoring bands, version, and provenance. It was normalized from the earlier `assessment-registry/GAD7/versions/1.0.0-draft.1/gad7.cleaned.json`; source question wording and scoring boundaries are retained.
- The standard form, Gemini question context, and deterministic backend scoring use this definition. The model cannot score or write an answer. Its `propose_answer` tool can only suggest a current, valid option after participant input. The UI requires explicit confirmation.
- `conversation_sessions` stores the patient link, frozen definition, confirmed answers, revision, and status. Updates use a row lock and revision check; stale confirmations are rejected. The browser stores only the draft UUID in session storage. Returning to that patient's conversation in the same tab resumes it. Typed or spoken transcripts and raw audio are not stored by this app. Google receives participant content; its service policies govern provider-side handling.
- WebSockets relay audio/text through the backend, which holds the Gemini key. No patient name, email, date of birth, or patient medical record is supplied to Gemini. A participant may nevertheless include personal details in their own response.
- Disconnecting or leaving the page closes the microphone and provider connection. Reconnection starts a new model conversation at the first unanswered question. It does not restore the previous transcript. Confirmed answers remain available even when Gemini is unavailable.
- Finalization is transactional and idempotent. Completed `assessments` include `administration_mode` and `definition_snapshot`, so history uses the wording/version that produced the result. Old rows without snapshots retain the original GAD-7 display.
- The local prototype has no user authentication. Origin checks and message/session limits are not a substitute for authentication. Use fictional data until access controls and clinical review are added. Conversational administration has not been clinically validated here. A model-triggered safety pause is best effort and is not a crisis assessment or clinician notification system.

## Adding future assessment JSON

Do not directly execute raw `assessment-url-preview` extraction output. It can include duplicate forms, missing questions, unverified scoring, or source content unrelated to the questionnaire. Review it and normalize one specific form/version into this contract:

```json
{
  "schemaVersion": 1,
  "id": "INSTRUMENT_ID",
  "version": "1.0.0-draft.1",
  "title": "Instrument title",
  "shortTitle": "Short title",
  "language": "en",
  "referencePeriod": "the source's exact reference period",
  "instructions": "Verified instructions",
  "questions": [
    {
      "id": "Q1",
      "text": "Verified question wording",
      "options": [
        { "value": 0, "label": "First response", "score": 0 },
        { "value": 1, "label": "Second response", "score": 1 }
      ]
    }
  ],
  "scoring": {
    "method": "sum",
    "min": 0,
    "max": 1,
    "bands": [{ "min": 0, "max": 1, "label": "Verified source label" }]
  }
}
```

This example illustrates shape, not a clinical instrument or valid interpretation rule. Retain provenance and review status as in `gad7.json`. Never invent missing bands merely to pass validation.

`shared/assessments/definition.js` validates unique IDs/options, supported scoring, and complete non-overlapping score bands. It sums each selected option's `score`, not the response `value`, so already-reversed scores must not be reversed again. Branching, multiple subscales, missing-answer imputation, and unverified severity bands are not supported by this first runtime contract.

Only GAD-7 is registered in this release. Adding another definition also requires registration, patient-selection UI, and a database migration: the existing assessments table deliberately still enforces the seven-item GAD-7 score constraints. Replace those constraints with an instrument-aware persistence design before enabling PHQ-9 or another instrument. Changing JSON alone does not enable a new assessment. Freeze new versions and preserve old snapshots.

## Verification

```bash
npm test
npm run build
npm run test:e2e
```

Backend tests use isolated PostgreSQL schemas. Conversation browser tests mock Gemini events only; drafts, review, history, and scoring use the actual API/database. Tests cover invalid/stale model output, explicit confirmation, reconnect/draft recovery, final review, idempotency, origin checks, and missing-key behavior. A real Gemini audio/text smoke test still requires an active key and compatible model access.

The transport follows Google's [Live SDK guide](https://ai.google.dev/gemini-api/docs/live-api/get-started-sdk), [function-calling guide](https://ai.google.dev/gemini-api/docs/live-api/tools), and [audio capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities). The reference implementation was the `sagar` branch of `Keviv21/PHQ-9-assessment`; its audio worklet was reused, while persistence and confirmation flow are implemented for this app.
