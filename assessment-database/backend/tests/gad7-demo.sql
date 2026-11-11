-- Run after docs/gad7-demo.sql in a disposable PostgreSQL database.
-- All test changes roll back; no clinical sources or APIs are contacted.
BEGIN;
DO $$
DECLARE result record;
BEGIN
  SELECT * INTO STRICT result FROM assessment_demo.session_results;
  IF result.total_score <> 8 OR result.severity <> 'Mild'
    OR result.answered_count <> 7 THEN
    RAISE EXCEPTION 'Unexpected sample result: %', row_to_json(result);
  END IF;
  IF (SELECT count(*) FROM assessment_demo.item_options) <> 28 THEN
    RAISE EXCEPTION 'Expected four choices for each of seven items';
  END IF;

  BEGIN
    UPDATE assessment_demo.session_responses SET option_id = 'invented_choice'
      WHERE item_id = 'gad7_q1';
    RAISE EXCEPTION 'Invalid choice was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    UPDATE assessment_demo.session_responses
      SET version_id = '10000000-0000-4000-8000-000000000099'
      WHERE item_id = 'gad7_q1';
    RAISE EXCEPTION 'Wrong assessment version was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO assessment_demo.session_responses
      SELECT * FROM assessment_demo.session_responses WHERE item_id = 'gad7_q1';
    RAISE EXCEPTION 'Duplicate response was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  DELETE FROM assessment_demo.session_responses WHERE item_id = 'gad7_q7';
  SELECT * INTO STRICT result FROM assessment_demo.session_results;
  IF result.total_score IS NOT NULL OR result.severity IS NOT NULL THEN
    RAISE EXCEPTION 'Incomplete questionnaire was scored';
  END IF;
END;
$$;
ROLLBACK;

-- Verify that every possible GAD-7 sum uses the expected boundary band.
BEGIN;
DO $$
DECLARE total integer; result record; expected text;
BEGIN
  FOR total IN 0..21 LOOP
    UPDATE assessment_demo.session_responses r
    SET option_id = choice.option_id
    FROM assessment_demo.instrument_items i, assessment_demo.item_options choice
    WHERE (r.version_id, r.item_id) = (i.version_id, i.item_id)
      AND (choice.version_id, choice.item_id) = (i.version_id, i.item_id)
      AND choice.score_value = least(3, greatest(0, total - (i.position - 1) * 3));
    SELECT * INTO STRICT result FROM assessment_demo.session_results;
    expected := CASE WHEN total < 5 THEN 'Minimal' WHEN total < 10 THEN 'Mild'
      WHEN total < 15 THEN 'Moderate' ELSE 'Severe' END;
    IF result.total_score <> total OR result.severity <> expected THEN
      RAISE EXCEPTION 'Wrong result for total %: %', total, row_to_json(result);
    END IF;
  END LOOP;
END;
$$;
ROLLBACK;
SELECT 'PASS: sample, answer constraints, incomplete answers, and all 22 totals' AS checks;
