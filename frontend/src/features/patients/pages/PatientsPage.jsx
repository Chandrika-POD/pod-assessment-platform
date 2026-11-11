import { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { age, initials, dateLabel } from '../../../lib/formatters.js';
import Badge from '../../assessments/components/ScoreBadge.jsx';

export default function PatientsPage({
  patients,
  loading,
  opening,
  view,
  onSelect,
  onAdd,
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const filtered = patients.filter((p) =>
    `${p.name} ${p.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const shown = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const assessed = patients.filter((p) => p.lastAssessedAt).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PATIENT CARE</div>
          <h1>
            {view === 'reports' ? 'Assessment reports' : 'Patient assessments'}
          </h1>
          <p>
            {view === 'reports'
              ? 'Review completed GAD-7 assessments and patient history.'
              : 'A clearer picture of your patients’ wellbeing starts here.'}
          </p>
        </div>
        <span className="assessment-label">
          <ClipboardList size={17} />
          GAD-7
        </span>
      </div>
      <div className="stats">
        <div>
          <span className="stat-icon blue">
            <Users size={20} />
          </span>
          <div>
            <small>Total patients</small>
            <strong>{patients.length.toString().padStart(2, '0')}</strong>
          </div>
        </div>
        <div>
          <span className="stat-icon green">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <small>Patients assessed</small>
            <strong>{assessed.toString().padStart(2, '0')}</strong>
          </div>
        </div>
        <div>
          <span className="stat-icon amber">
            <Clock3 size={20} />
          </span>
          <div>
            <small>Awaiting first assessment</small>
            <strong>
              {(patients.length - assessed).toString().padStart(2, '0')}
            </strong>
          </div>
        </div>
      </div>
      <section className="panel patient-panel">
        <div className="panel-intro">
          <div>
            <h2>
              {view === 'reports' ? 'Patient reports' : 'Select a patient'}
            </h2>
            <p>
              {view === 'reports'
                ? 'Open a patient to view their full assessment history.'
                : 'Choose a patient to review their details and begin an assessment.'}
            </p>
          </div>
          <span className="count-pill">{patients.length} patients</span>
        </div>
        <div className="search-row">
          <label className="search-box">
            <Search size={19} />
            <input
              aria-label="Search patients"
              placeholder="Search by patient name or email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
              >
                <X size={16} />
              </button>
            )}
          </label>
          <button className="button outline" onClick={() => onAdd()}>
            <Plus size={18} />
            Add Patient
          </button>
        </div>
        <div className="list-header">
          <span>PATIENT DETAILS</span>
          <span>LATEST ASSESSMENT</span>
        </div>
        <div className="patient-list" aria-busy={loading || opening}>
          {loading ? (
            <div className="empty-state">Loading patients…</div>
          ) : !shown.length ? (
            <div className="empty-state">
              <Search size={27} />
              <h3>No patients found</h3>
              <p>Try another name or add a new patient.</p>
            </div>
          ) : (
            shown.map((p) => (
              <button
                className="patient-row"
                key={p.id}
                disabled={opening}
                onClick={() => onSelect(p.id)}
              >
                <span className="avatar">{initials(p.name)}</span>
                <span className="patient-info">
                  <strong>{p.name}</strong>
                  <small>
                    {age(p.dateOfBirth)} years <b>·</b> {p.gender} <b>·</b>{' '}
                    {p.email}
                  </small>
                </span>
                <span className="patient-status">
                  <Badge severity={p.latestSeverity} score={p.latestScore} />
                  {p.lastAssessedAt && (
                    <small>{dateLabel(p.lastAssessedAt)}</small>
                  )}
                </span>
                <ChevronRight size={18} className="row-arrow" />
              </button>
            ))
          )}
        </div>
        <div className="pagination">
          <label>
            Items per page{' '}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option>5</option>
              <option>10</option>
              <option>20</option>
            </select>
          </label>
          <span>
            {filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–
            {Math.min(currentPage * pageSize, filtered.length)} of{' '}
            {filtered.length} patients
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="current-page">{currentPage}</span>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      <p className="bottom-note">
        <Activity size={15} />
        Thoughtful assessment. Better-informed care.
      </p>
    </>
  );
}
