import { api } from './http.js';

export const listPatients = () => api('/patients');
export const getPatient = (id) => api(`/patients/${id}`);
export const createPatient = (patient) =>
  api('/patients', { method: 'POST', body: JSON.stringify(patient) });
export const saveAssessment = (patientId, assessment) =>
  api(`/patients/${patientId}/assessments`, {
    method: 'POST',
    body: JSON.stringify(assessment),
  });
