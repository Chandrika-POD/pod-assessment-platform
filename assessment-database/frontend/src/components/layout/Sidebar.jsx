import {
  Activity,
  BookOpen,
  ChevronDown,
  ClipboardList,
  FilePlus2,
  FileText,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';

export default function Sidebar({ sidebar, setSidebar, view, navigate }) {
  return (
    <>
      <aside className={`sidebar ${sidebar ? 'is-open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('patients');
          }}
        >
          <span className="brand-symbol">
            <Activity size={22} />
          </span>
          Open<span>Mind</span>
        </a>
        <div className="workspace-label">CLINICAL WORKSPACE</div>
        <nav aria-label="Main navigation">
          <div
            className="nav-unavailable"
            title="Not included in this prototype"
          >
            <BookOpen size={19} />
            Patient Casebooks<span className="soon">Soon</span>
          </div>
          <div
            className="nav-unavailable"
            title="Not included in this prototype"
          >
            <SlidersHorizontal size={19} />
            MindScribe<span className="soon">Soon</span>
          </div>
          <div className="nav-parent">
            <ClipboardList size={19} />
            Patient Assessments & Tests
            <ChevronDown size={15} />
          </div>
          <div className="nav-branch">
            <div className="nav-category">
              <Activity size={17} />
              <span>GAD-7 Assessment</span>
            </div>
            <button
              className={`nav-child ${view !== 'reports' ? 'active' : ''}`}
              onClick={() => navigate('patients')}
            >
              <FilePlus2 size={17} />
              Assess Patients
            </button>
            <button
              className={`nav-child ${view === 'reports' ? 'active' : ''}`}
              onClick={() => navigate('reports')}
            >
              <FileText size={17} />
              View Test Reports
            </button>
          </div>
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-note">
            <span className="status-dot" />
            <div>
              Demo workspace<small>Dummy patients · No sign-in required</small>
            </div>
          </div>
          <div className="version">
            <Layers size={16} />
            Assessment Database <span>v0.1</span>
          </div>
        </div>
      </aside>
      {sidebar && (
        <button
          aria-label="Close navigation"
          className="sidebar-overlay"
          onClick={() => setSidebar(false)}
        />
      )}
    </>
  );
}
