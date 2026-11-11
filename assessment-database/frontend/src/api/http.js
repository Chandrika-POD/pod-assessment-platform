export async function api(url, options = {}) {
  let response;
  try {
    response = await fetch(`/api${url}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new Error(
      'Cannot connect to the server. Check that the app is running and try again.',
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new Error(
      data?.error || 'The request could not be completed. Please try again.',
    );
  return data;
}
