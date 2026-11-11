import { Activity, ChevronRight, Menu } from 'lucide-react';
import Sidebar from './Sidebar.jsx';

export default function AppLayout({
  children,
  sidebar,
  setSidebar,
  view,
  navigate,
  error,
  loadPatients,
}) {
  return (
    <div className="app-shell">
      <Sidebar {...{ sidebar, setSidebar, view, navigate }} />
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebar(true)}
            >
              <Menu size={21} />
            </button>
            <span className="workspace-pill">
              <Activity size={17} />
              OpenMind Assessments
            </span>
          </div>
          <div className="topbar-right">
            <span className="demo-label">LOCAL DEMO</span>
            <span className="avatar small">OM</span>
          </div>
        </header>
        <main>
          <div className="breadcrumb">
            Patient Assessments & Tests <ChevronRight size={14} />
            <span>GAD-7</span>
          </div>
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button onClick={loadPatients}>Retry</button>
            </div>
          )}
          {children}
        </main>
        <footer>
          OpenMind <span>Patient Assessment Workspace</span>
        </footer>
      </div>
    </div>
  );
}
