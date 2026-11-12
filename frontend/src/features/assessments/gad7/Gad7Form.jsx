import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Clock3 } from 'lucide-react';
import {
  GAD7,
  QUESTIONS,
  OPTIONS,
} from '../../../../../shared/assessments/gad7.js';
import { saveAssessment } from '../../../api/patients.js';
import { age, initials } from '../../../lib/formatters.js';
import Modal from '../../../components/ui/Modal.jsx';

export default function Gad7Form({ patient, onCancel, onSaved }) {
  const [answers, setAnswers] = useState(Array(QUESTIONS.length).fill(null));
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const answered = answers.filter((value) => value !== null).length;
  const formRef = useRef(null);
  useEffect(() => {
    const warn = (event) => {
      if (answered) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [answered]);
  async function submit(event) {
    event.preventDefault();
    setAttempted(true);
    if (answered !== QUESTIONS.length) {
      setError('Please answer all seven questions before saving.');
      formRef.current?.querySelector('[data-unanswered="true"] input')?.focus();
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await saveAssessment(patient.id, {
        answers,
        submissionId,
      });
      await onSaved(result);
    } catch (error) {
      setError(error.message);
      setSubmitting(false);
    }
  }
  const cancel = () => (answered ? setConfirmCancel(true) : onCancel());
  return (
    <>
      <button className="back-link" disabled={submitting} onClick={cancel}>
        <ArrowLeft size={17} />
        Back to patient details
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">GAD-7 · SELF-REPORT</div>
          <h1>{GAD7.title}</h1>
          <p>
            Seven questions to understand anxiety symptoms over the past two
            weeks.
          </p>
        </div>
      </div>
      <div className="form-patient">
        <span className="avatar small">{initials(patient.name)}</span>
        <strong>{patient.name}</strong>
        <span>
          {age(patient.dateOfBirth)} years · {patient.gender}
        </span>
        <span className="form-patient-time">
          <Clock3 size={15} />
          About 2 minutes
        </span>
      </div>
      <form ref={formRef} onSubmit={submit} noValidate>
        <section className="panel questionnaire">
          <div className="questionnaire-intro">
            <div>
              <h2>{GAD7.instructions}</h2>
              <p>Select one response for each question.</p>
            </div>
            <span>
              {answered} of {QUESTIONS.length} answered
            </span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Questions answered"
            aria-valuenow={answered}
            aria-valuemin={0}
            aria-valuemax={QUESTIONS.length}
          >
            <div style={{ width: `${(answered / QUESTIONS.length) * 100}%` }} />
          </div>
          {QUESTIONS.map((question, index) => (
            <fieldset
              key={question}
              disabled={submitting}
              data-unanswered={answers[index] === null}
              className={`question ${attempted && answers[index] === null ? 'unanswered' : ''}`}
            >
              <legend>
                <span className="question-number">{index + 1}</span>
                {question}
              </legend>
              <div className="answer-options">
                {OPTIONS.map((option, value) => (
                  <label
                    className={answers[index] === value ? 'selected' : ''}
                    key={option}
                  >
                    <input
                      type="radio"
                      name={`question-${index}`}
                      value={value}
                      checked={answers[index] === value}
                      onChange={() => {
                        setAnswers((previous) =>
                          previous.map((answer, i) =>
                            i === index ? value : answer,
                          ),
                        );
                        setSubmissionId(crypto.randomUUID());
                        setError('');
                      }}
                    />
                    <span>{option}</span>
                    <small>{value}</small>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="form-footer">
            {error && (
              <div role="alert" className="error-banner">
                {error}
              </div>
            )}
            <div className="form-actions">
              <span>
                <CheckCircle2 size={16} />
                Your answers will be saved to {patient.name}’s record.
              </span>
              <div>
                <button
                  type="button"
                  className="button outline"
                  disabled={submitting}
                  onClick={cancel}
                >
                  Cancel
                </button>
                <button
                  className="button primary"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? 'Saving assessment…' : 'Save assessment'}
                  {!submitting && <Check size={17} />}
                </button>
              </div>
            </div>
          </div>
        </section>
      </form>
      <p className="clinical-note">
        GAD-7 is a screening tool, not a diagnosis. Results should be
        interpreted in clinical context.{' '}
        <a
          href="https://novopsych.com/assessments/anxiety/generalised-anxiety-disorder-assessment-gad-7/"
          target="_blank"
          rel="noreferrer"
        >
          About this assessment ↗
        </a>
      </p>
      {confirmCancel && (
        <Modal
          title="Leave this assessment?"
          onClose={() => setConfirmCancel(false)}
        >
          <p>Your answers have not been saved.</p>
          <div className="modal-actions">
            <button
              className="button outline"
              onClick={() => setConfirmCancel(false)}
            >
              Keep answering
            </button>
            <button className="button primary" onClick={onCancel}>
              Discard answers
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
