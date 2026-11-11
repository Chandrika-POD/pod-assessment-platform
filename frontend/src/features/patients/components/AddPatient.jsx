import { useState } from 'react';
import Modal from '../../../components/ui/Modal.jsx';
import { createPatient } from '../../../api/patients.js';

export default function AddPatient({ onClose, onAdded }) {
  const [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    setError('');
    try {
      await createPatient(data);
      await onAdded();
    } catch (error) {
      setError(error.message);
      setSaving(false);
    }
  }
  return (
    <Modal title="Add patient" onClose={() => !saving && onClose()}>
      <p className="muted">Create a patient record to start an assessment.</p>
      <form onSubmit={submit} className="add-form">
        <label>
          Full name
          <input
            autoFocus
            required
            name="name"
            minLength={2}
            maxLength={120}
            placeholder="e.g. Priya Sharma"
          />
        </label>
        <label>
          Date of birth
          <input
            required
            name="dateOfBirth"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
          />
        </label>
        <label>
          Gender
          <select required name="gender" defaultValue="">
            <option value="" disabled>
              Select gender
            </option>
            {['Male', 'Female', 'Other', 'Prefer not to say'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Email
          <input
            required
            type="email"
            name="email"
            maxLength={254}
            placeholder="patient@example.com"
          />
        </label>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button outline"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? 'Adding…' : 'Add patient'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
