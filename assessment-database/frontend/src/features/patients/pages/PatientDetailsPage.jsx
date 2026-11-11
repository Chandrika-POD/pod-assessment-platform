import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Users,
} from 'lucide-react';
import { age, initials, dateLabel } from '../../../lib/formatters.js';
import AssessmentHistory from '../../assessments/components/AssessmentHistory.jsx';

export default function PatientDetailsPage({
  patient,
  saved,
  onBack,
  onStart,
}) {
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={17} />
        Back to patients
      </button>
      <div className="steps">
        <span className="complete">
          <i>
            <Check size={15} />
          </i>
          Patient details
        </span>
        <div />
        <span className="current">
          <i>2</i>Select assessment
        </span>
      </div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PATIENT RECORD</div>
          <h1>{patient.name}</h1>
          <p>Review patient details and complete a new assessment.</p>
        </div>
        <span className="avatar large">{initials(patient.name)}</span>
      </div>
      {saved && (
        <div className="success-banner" role="status">
          <CheckCircle2 size={22} />
          <div>
            <strong>Assessment saved successfully</strong>
            <p>
              GAD-7 score: {saved.score}/21 · {saved.severity} anxiety symptoms.
              This result is now in {patient.name}’s record.
            </p>
          </div>
        </div>
      )}
      <section className="panel">
        <div className="section-title">
          <ClipboardList size={18} />
          <h2>Available assessment</h2>
        </div>
        <div className="assessment-card">
          <div className="assessment-icon">
            <Activity size={28} />
          </div>
          <div>
            <span className="eyebrow">ANXIETY · SELF-REPORT</span>
            <h3>Generalised Anxiety Disorder Assessment</h3>
            <p>
              GAD-7 <span>·</span> 7 questions <span>·</span> About 2 minutes
            </p>
          </div>
          <button className="button primary" onClick={onStart}>
            Start GAD-7
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
      <section className="panel">
        <div className="section-title">
          <Users size={18} />
          <h2>Patient details</h2>
        </div>
        <dl className="details-list">
          {[
            ['Name', patient.name],
            ['Date of birth', dateLabel(patient.dateOfBirth)],
            ['Age', `${age(patient.dateOfBirth)} years`],
            ['Email', patient.email],
            ['Gender', patient.gender],
          ].map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <AssessmentHistory assessments={patient.assessments} />
    </>
  );
}
