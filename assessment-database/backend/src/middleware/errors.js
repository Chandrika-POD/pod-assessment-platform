import { z } from 'zod';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof HttpError)
    return res.status(error.status).json({ error: error.message });
  if (error instanceof z.ZodError) {
    return res
      .status(400)
      .json({ error: error.issues.map((issue) => issue.message).join('. ') });
  }
  if (error.type === 'entity.parse.failed')
    return res.status(400).json({ error: 'Invalid JSON request.' });
  if (error.type === 'entity.too.large')
    return res.status(413).json({ error: 'Request is too large.' });
  console.error('Request failed:', error.message);
  res.status(503).json({
    error: 'Unable to access the database. Check PostgreSQL and try again.',
  });
}
