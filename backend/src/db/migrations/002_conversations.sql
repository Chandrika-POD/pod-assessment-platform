ALTER TABLE assessments ADD COLUMN IF NOT EXISTS definition_snapshot jsonb;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS administration_mode text NOT NULL DEFAULT 'form'
  CHECK (administration_mode IN ('form', 'conversation'));
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  definition jsonb NOT NULL,
  answers jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_patient_idx ON conversation_sessions(patient_id, updated_at DESC);
