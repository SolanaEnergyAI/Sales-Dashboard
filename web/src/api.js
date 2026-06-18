// Tiny fetch wrapper for the dashboard API.

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export function fetchMeta() {
  return getJson('/api/meta');
}

export function fetchHealth() {
  return getJson('/api/health');
}

export function fetchMetrics({ timeframe, from, to }) {
  const params = new URLSearchParams({ timeframe });
  if (timeframe === 'custom') {
    if (from) params.set('from', from);
    if (to) params.set('to', to);
  }
  return getJson(`/api/metrics?${params.toString()}`);
}

export function fetchPerson({ role, id, timeframe, from, to }) {
  const params = new URLSearchParams({ role, id, timeframe });
  if (timeframe === 'custom') {
    if (from) params.set('from', from);
    if (to) params.set('to', to);
  }
  return getJson(`/api/person?${params.toString()}`);
}

export async function triggerRefresh() {
  const res = await fetch('/api/refresh', { method: 'POST' });
  return res.json();
}
