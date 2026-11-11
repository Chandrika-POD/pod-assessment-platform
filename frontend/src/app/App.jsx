import { useEffect, useRef, useState } from 'react';
import { listPatients, getPatient } from '../api/patients.js';
import AppLayout from '../components/layout/AppLayout.jsx';
import PatientsPage from '../features/patients/pages/PatientsPage.jsx';
import PatientDetailsPage from '../features/patients/pages/PatientDetailsPage.jsx';
import AddPatient from '../features/patients/components/AddPatient.jsx';
import Gad7Form from '../features/assessments/gad7/Gad7Form.jsx';

export default function App() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('patients');
  const [patient, setPatient] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [saved, setSaved] = useState(null);
  const [opening, setOpening] = useState(false);
  const requestVersion = useRef(0);
  async function loadPatients() {
    setLoading(true);
    setError('');
    try {
      setPatients(await listPatients());
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadPatients();
  }, []);
  async function openPatient(id) {
    const version = ++requestVersion.current;
    setOpening(true);
    setError('');
    try {
      const data = await getPatient(id);
      if (version !== requestVersion.current) return;
      setPatient(data);
      setSaved(null);
      setView('details');
      window.scrollTo(0, 0);
    } catch (error) {
      if (version === requestVersion.current) setError(error.message);
    } finally {
      if (version === requestVersion.current) setOpening(false);
    }
  }
  function navigate(next) {
    if (
      view === 'form' &&
      !window.confirm(
        'Leave this assessment? Any unsaved answers will be discarded.',
      )
    )
      return;
    ++requestVersion.current;
    setOpening(false);
    setView(next);
    setSidebar(false);
    setError('');
    setSaved(null);
    if (next === 'patients' || next === 'reports') loadPatients();
  }
  async function onSaved(result) {
    setSaved(result);
    setPatient((current) => ({
      ...current,
      assessments: [
        result,
        ...current.assessments.filter((item) => item.id !== result.id),
      ],
    }));
    setView('details');
    window.scrollTo(0, 0);
    await loadPatients();
  }
  return (
    <>
      <AppLayout
        {...{ sidebar, setSidebar, view, navigate, error, loadPatients }}
      >
        {(view === 'patients' || view === 'reports') && (
          <PatientsPage
            {...{ patients, loading, opening, view }}
            onSelect={openPatient}
            onAdd={() => setShowAdd(true)}
          />
        )}
        {view === 'details' && patient && (
          <PatientDetailsPage
            {...{ patient, saved }}
            onBack={() => navigate('patients')}
            onStart={() => {
              setSaved(null);
              setView('form');
              window.scrollTo(0, 0);
            }}
          />
        )}
        {view === 'form' && patient && (
          <Gad7Form
            patient={patient}
            onCancel={() => setView('details')}
            onSaved={onSaved}
          />
        )}
      </AppLayout>
      {showAdd && (
        <AddPatient
          onClose={() => setShowAdd(false)}
          onAdded={async () => {
            setShowAdd(false);
            await loadPatients();
          }}
        />
      )}
    </>
  );
}
