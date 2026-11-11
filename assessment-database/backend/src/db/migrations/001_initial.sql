CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  date_of_birth date NOT NULL,
  gender text NOT NULL CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  instrument_version text NOT NULL DEFAULT 'GAD-7-v1' CHECK (instrument_version = 'GAD-7-v1'),
  answers integer[] NOT NULL CHECK (
    array_ndims(answers) = 1 AND array_lower(answers, 1) = 1 AND cardinality(answers) = 7
    AND array_position(answers, NULL) IS NULL AND 0 <= ALL(answers) AND 3 >= ALL(answers)
  ),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 21 AND
    score = answers[1] + answers[2] + answers[3] + answers[4] + answers[5] + answers[6] + answers[7]),
  severity text NOT NULL CHECK (severity = CASE WHEN score < 5 THEN 'Minimal' WHEN score < 10 THEN 'Mild' WHEN score < 15 THEN 'Moderate' ELSE 'Severe' END),
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assessments_patient_date_idx ON assessments (patient_id, completed_at DESC);
