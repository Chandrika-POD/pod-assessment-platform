-- Standalone PostgreSQL 14+ sample. Fictional data; not a clinical release.
-- Run this entire file in DBeaver's SQL script mode, or:
-- psql -h 127.0.0.1 -p 55432 -U assessment -d assessment_db \
--   -v ON_ERROR_STOP=1 -f docs/gad7-demo.sql
-- Creates only assessment_demo.*. Existing application tables are untouched.
-- A second run fails at CREATE SCHEMA instead of overwriting your demo data.
-- Questions/options/scoring copied from shared/assessments/gad7.js.
-- This sample supports single-choice, complete-case summed scores only.
-- Other response types/scoring methods need additional validated handlers.

BEGIN;
CREATE SCHEMA assessment_demo;

CREATE TABLE assessment_demo.instruments (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL
);

CREATE TABLE assessment_demo.instrument_variants (
  id text PRIMARY KEY,
  instrument_id text NOT NULL REFERENCES assessment_demo.instruments(id),
  locale text NOT NULL,
  respondent_type text NOT NULL,
  UNIQUE (instrument_id, locale, respondent_type)
);

CREATE TABLE assessment_demo.instrument_versions (
  id uuid PRIMARY KEY,
  variant_id text NOT NULL REFERENCES assessment_demo.instrument_variants(id),
  version text NOT NULL,
  review_status text NOT NULL CHECK (review_status IN ('draft', 'ready_for_test')),
  expected_item_count integer NOT NULL CHECK (expected_item_count > 0),
  instructions jsonb NOT NULL,
  scoring_rules jsonb NOT NULL,
  clinical_context jsonb NOT NULL,
  conversation_policy jsonb NOT NULL,
  provenance jsonb NOT NULL,
  UNIQUE (variant_id, version)
);

CREATE TABLE assessment_demo.instrument_items (
  version_id uuid NOT NULL REFERENCES assessment_demo.instrument_versions(id),
  item_id text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  wording text NOT NULL,
  response_type text NOT NULL CHECK (response_type = 'single_choice'),
  PRIMARY KEY (version_id, item_id),
  UNIQUE (version_id, position)
);

CREATE TABLE assessment_demo.item_options (
  version_id uuid NOT NULL,
  item_id text NOT NULL,
  option_id text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  label text NOT NULL,
  score_value numeric NOT NULL,
  PRIMARY KEY (version_id, item_id, option_id),
  UNIQUE (version_id, item_id, position),
  FOREIGN KEY (version_id, item_id)
    REFERENCES assessment_demo.instrument_items(version_id, item_id)
);

CREATE TABLE assessment_demo.patients (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  is_fictional boolean NOT NULL DEFAULT true CHECK (is_fictional)
);

CREATE TABLE assessment_demo.assessment_sessions (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES assessment_demo.patients(id),
  version_id uuid NOT NULL REFERENCES assessment_demo.instrument_versions(id),
  mode text NOT NULL CHECK (mode IN ('standard_form', 'text_chat', 'live_voice')),
  status text NOT NULL CHECK (status IN ('in_progress', 'completed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  model_name text,
  prompt_version text,
  UNIQUE (id, version_id),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

CREATE TABLE assessment_demo.session_responses (
  session_id uuid NOT NULL,
  version_id uuid NOT NULL,
  item_id text NOT NULL,
  option_id text NOT NULL,
  method text NOT NULL CHECK (method IN ('screen', 'text', 'voice')),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, item_id),
  FOREIGN KEY (session_id, version_id)
    REFERENCES assessment_demo.assessment_sessions(id, version_id),
  FOREIGN KEY (version_id, item_id, option_id)
    REFERENCES assessment_demo.item_options(version_id, item_id, option_id)
);

CREATE INDEX demo_sessions_patient_date_idx
  ON assessment_demo.assessment_sessions(patient_id, started_at DESC);

-- Derive results from confirmed answers; never trust a supplied model/client score.
-- Incomplete sessions have NULL score and severity, not zero.
-- A production scoring service should persist immutable result revisions;
-- this view deliberately keeps the testing sample small.
CREATE VIEW assessment_demo.session_results AS
WITH totals AS (
  SELECT s.id AS session_id, s.patient_id, s.version_id, s.status,
    s.completed_at, v.version, v.scoring_rules, v.expected_item_count,
    i.id AS instrument_code, i.name AS assessment_name,
    count(r.item_id)::integer AS answered_count,
    sum(o.score_value) AS answer_sum,
    (SELECT count(*) FROM assessment_demo.instrument_items item
      WHERE item.version_id = v.id) AS defined_count
  FROM assessment_demo.assessment_sessions s
  JOIN assessment_demo.instrument_versions v ON v.id = s.version_id
  JOIN assessment_demo.instrument_variants variant ON variant.id = v.variant_id
  JOIN assessment_demo.instruments i ON i.id = variant.instrument_id
  LEFT JOIN assessment_demo.session_responses r ON r.session_id = s.id
  LEFT JOIN assessment_demo.item_options o
    ON (o.version_id, o.item_id, o.option_id) =
       (r.version_id, r.item_id, r.option_id)
  GROUP BY s.id, v.id, i.id
), scored AS (
  SELECT *, CASE WHEN status = 'completed'
    AND answered_count = expected_item_count AND defined_count = expected_item_count
    AND scoring_rules->>'method' = 'sum'
    AND scoring_rules->>'missing_answers' = 'require_all'
    THEN answer_sum ELSE NULL END AS total_score
  FROM totals
)
SELECT s.session_id, s.patient_id, s.instrument_code, s.assessment_name,
  s.version_id, s.version, s.status, s.answered_count, s.expected_item_count,
  s.total_score, (s.scoring_rules->>'max_score')::numeric AS max_score,
  (SELECT band.label
   FROM jsonb_to_recordset(s.scoring_rules->'bands')
     AS band(min numeric, max numeric, label text)
   WHERE s.total_score BETWEEN band.min AND band.max) AS severity,
  s.completed_at
FROM scored s;

INSERT INTO assessment_demo.instruments VALUES
  ('GAD7', 'Generalised Anxiety Disorder Assessment (GAD-7)', 'anxiety');

INSERT INTO assessment_demo.instrument_variants VALUES
  ('GAD7-en-self', 'GAD7', 'en', 'self');

INSERT INTO assessment_demo.instrument_versions VALUES (
  '10000000-0000-4000-8000-000000000001', 'GAD7-en-self', '1.0.0-test',
  'ready_for_test', 7,
  '{"reference_period":"past two weeks","prompt":"Over the last two weeks, how often have you been bothered by the following problems?","completion":"Select one response for every question."}',
  '{"method":"sum","missing_answers":"require_all","max_score":21,"bands":[{"min":0,"max":4,"label":"Minimal"},{"min":5,"max":9,"label":"Mild"},{"min":10,"max":14,"label":"Moderate"},{"min":15,"max":21,"label":"Severe"}]}',
  '{"purpose":"Anxiety symptom screening","limitation":"Screening result, not a diagnosis.","normative_data":null,"clinical_review_status":"not_reviewed_for_release"}',
  '{"ask_one_item_at_a_time":true,"use_canonical_wording":true,"clarify_ambiguous_answers":true,"confirm_mapped_choices":true,"allow_inferred_answers_from_history":false,"score_owner":"backend","gemini_integration":"not_connected"}',
  '{"question_and_score_source":"shared/assessments/gad7.js","reference_url":"https://novopsych.com/assessments/anxiety/generalised-anxiety-disorder-assessment-gad-7/","purpose":"software_testing","content_usage_review":"not_performed_by_this_sample"}'
);

INSERT INTO assessment_demo.instrument_items
  (version_id, item_id, position, wording, response_type)
SELECT '10000000-0000-4000-8000-000000000001'::uuid,
  'gad7_q' || position, position, wording, 'single_choice'
FROM (VALUES
  (1, 'Feeling nervous, anxious or on edge'),
  (2, 'Not being able to stop or control worrying'),
  (3, 'Worrying too much about different things'),
  (4, 'Trouble relaxing'),
  (5, 'Being so restless that it is hard to sit still'),
  (6, 'Becoming easily annoyed or irritable'),
  (7, 'Feeling afraid as if something awful might happen')
) AS questions(position, wording);

INSERT INTO assessment_demo.item_options
SELECT i.version_id, i.item_id, c.option_id, c.position, c.label, c.score_value
FROM assessment_demo.instrument_items i
CROSS JOIN (VALUES
  ('not_at_all', 1, 'Not at all', 0),
  ('several_days', 2, 'Several days', 1),
  ('more_than_half', 3, 'More than half the days', 2),
  ('nearly_every_day', 4, 'Nearly every day', 3)
) AS c(option_id, position, label, score_value);

INSERT INTO assessment_demo.patients VALUES
  ('20000000-0000-4000-8000-000000000001', 'Demo Patient — fictional', true);

INSERT INTO assessment_demo.assessment_sessions
  (id, patient_id, version_id, mode, status, started_at, completed_at)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'standard_form', 'completed', now() - interval '5 minutes', now()
);

-- Sample choices score [1,2,1,2,1,0,1] = 8 (Mild).
INSERT INTO assessment_demo.session_responses
  (session_id, version_id, item_id, option_id, method)
SELECT '30000000-0000-4000-8000-000000000001'::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  'gad7_q' || n, option_id, 'screen'
FROM (VALUES
  (1, 'several_days'), (2, 'more_than_half'), (3, 'several_days'),
  (4, 'more_than_half'), (5, 'several_days'), (6, 'not_at_all'),
  (7, 'several_days')
) AS answers(n, option_id);

COMMIT;

-- Open this view in DBeaver to see the sample result.
SELECT instrument_code, version, answered_count, total_score, max_score, severity
FROM assessment_demo.session_results;

-- Inspect the questionnaire and selected answers.
SELECT i.position, i.wording, o.label AS selected_answer, o.score_value
FROM assessment_demo.session_responses r
JOIN assessment_demo.instrument_items i
  ON (i.version_id, i.item_id) = (r.version_id, r.item_id)
JOIN assessment_demo.item_options o
  ON (o.version_id, o.item_id, o.option_id) =
     (r.version_id, r.item_id, r.option_id)
WHERE r.session_id = '30000000-0000-4000-8000-000000000001'
ORDER BY i.position;
