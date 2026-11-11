-- Run these read-only queries in DBeaver against assessment_db.

-- Patient records.
SELECT id, name, date_of_birth, gender, email, created_at
FROM public.patients
ORDER BY name;

-- Assessment history with patient names.
SELECT
  p.name AS patient_name,
  p.email,
  a.instrument_version,
  a.answers,
  a.score,
  a.severity,
  a.completed_at
FROM public.assessments a
JOIN public.patients p ON p.id = a.patient_id
ORDER BY a.completed_at DESC;

-- One column per GAD-7 answer for easier visual inspection.
SELECT
  p.name AS patient_name,
  a.answers[1] AS question_1,
  a.answers[2] AS question_2,
  a.answers[3] AS question_3,
  a.answers[4] AS question_4,
  a.answers[5] AS question_5,
  a.answers[6] AS question_6,
  a.answers[7] AS question_7,
  a.score,
  a.severity,
  a.completed_at
FROM public.assessments a
JOIN public.patients p ON p.id = a.patient_id
ORDER BY a.completed_at DESC;

-- Patients without completed assessments also appear here.
SELECT p.id, p.name, count(a.id) AS assessment_count,
  max(a.completed_at) AS last_assessed_at
FROM public.patients p
LEFT JOIN public.assessments a ON a.patient_id = p.id
GROUP BY p.id, p.name
ORDER BY p.name;
