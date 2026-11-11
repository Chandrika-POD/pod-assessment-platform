export default function ScoreBadge({ severity, score }) {
  return (
    <span className={`badge ${severity?.toLowerCase() || 'neutral'}`}>
      {severity ? `${severity} · ${score}/21` : 'Not assessed'}
    </span>
  );
}
