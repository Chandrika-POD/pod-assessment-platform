import { ChevronDown, Clock3, FileText } from 'lucide-react';
import { QUESTIONS, OPTIONS } from '../../../../../shared/assessments/gad7.js';
import { timeLabel } from '../../../lib/formatters.js';
import Badge from './ScoreBadge.jsx';

export default function AssessmentHistory({ assessments }) {
  return (
    <section className="panel">
      <div className="section-title">
        <Clock3 size={18} />
        <h2>Assessment history</h2>
        <span className="count-pill">{assessments.length}</span>
      </div>
      {!assessments.length ? (
        <div className="empty-state compact">
          <FileText size={28} />
          <h3>No assessments yet</h3>
          <p>Completed GAD-7 assessments will appear here.</p>
        </div>
      ) : (
        <div className="history-list">
          {assessments.map((result) => (
            <details key={result.id} className="history-item">
              <summary>
                <div>
                  <strong>
                    GAD-7 assessment
                    {result.mode === 'conversation' ? ' · Conversation' : ''}
                  </strong>
                  <small>{timeLabel(result.completedAt)}</small>
                </div>
                <Badge severity={result.severity} score={result.score} />
                <ChevronDown size={17} />
              </summary>
              <div className="answer-review">
                {(
                  result.definition?.questions.map((q) => q.text) || QUESTIONS
                ).map((question, index) => (
                  <div key={question}>
                    <span>
                      {index + 1}. {question}
                    </span>
                    <strong>
                      {result.definition?.questions[index].options.find(
                        (o) => o.value === result.answers[index],
                      )?.label || OPTIONS[result.answers[index]]}{' '}
                      <small>({result.answers[index]})</small>
                    </strong>
                  </div>
                ))}
                {result.definition && (
                  <p className="clinical-note">
                    Definition {result.definition.version} ·{' '}
                    {result.mode === 'conversation'
                      ? 'User-confirmed conversational responses'
                      : 'Self-report form'}
                  </p>
                )}
                <p className="clinical-note">
                  A screening result supports clinical review; it is not a
                  diagnosis.
                </p>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
