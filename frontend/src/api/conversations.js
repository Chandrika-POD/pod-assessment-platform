import { api } from './http.js';
export const assessmentDefinitions = () => api('/assessment-definitions');
export const getConversation = (id) => api(`/conversations/${id}`);
export const createConversation = (body) =>
  api('/conversations', { method: 'POST', body: JSON.stringify(body) });
export const confirmAnswer = (id, body) =>
  api(`/conversations/${id}/answers`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
export const finalizeConversation = (id, revision) =>
  api(`/conversations/${id}/finalize`, {
    method: 'POST',
    body: JSON.stringify({ revision }),
  });
