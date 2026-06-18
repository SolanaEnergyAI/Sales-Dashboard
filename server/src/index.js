/**
 * Solana Energy Sales Dashboard — backend API.
 * Serves computed CRM metrics from cache, plus the built frontend in production.
 */
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';

import { runtime } from './config.js';
import { startAutoRefresh, getState, isReady, refresh } from './dataStore.js';
import { computeMetrics, computePersonDetail, CONVERSION_LABELS } from './metrics.js';
import { TIMEFRAME_IDS, TIMEFRAME_LABELS } from './timeframes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

const api = express.Router();

api.get('/health', (req, res) => {
  const s = getState();
  res.json({
    ok: true,
    ready: isReady(),
    lastRefreshed: s.lastRefreshed,
    lastError: s.lastError,
    counts: s.counts,
    users: s.usersById.size,
    timezone: runtime.timezone,
    refreshIntervalSeconds: runtime.refreshIntervalSeconds,
    tokenConfigured: Boolean(runtime.mondayToken),
  });
});

api.get('/meta', (req, res) => {
  res.json({
    timeframes: TIMEFRAME_IDS.map((id) => ({ id, label: TIMEFRAME_LABELS[id] })),
    conversionLabels: CONVERSION_LABELS,
  });
});

api.get('/metrics', (req, res) => {
  if (!isReady()) {
    return res.status(503).json({
      error: 'Data not loaded yet. The first Monday.com sync is still running.',
      lastError: getState().lastError,
    });
  }
  const timeframe = String(req.query.timeframe || 'this_month');
  if (!TIMEFRAME_IDS.includes(timeframe)) {
    return res.status(400).json({ error: `Unknown timeframe: ${timeframe}` });
  }
  const custom = { from: req.query.from, to: req.query.to };
  try {
    const data = computeMetrics(getState().normalized, timeframe, custom);
    res.json({
      ...data,
      lastRefreshed: getState().lastRefreshed,
      timeframeLabel: TIMEFRAME_LABELS[timeframe],
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

api.get('/person', (req, res) => {
  if (!isReady()) return res.status(503).json({ error: 'Data not loaded yet.' });
  const role = String(req.query.role || 'leadGen');
  const id = String(req.query.id || '');
  const timeframe = String(req.query.timeframe || 'this_month');
  if (!['leadGen', 'salesRep'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (!id) return res.status(400).json({ error: 'Missing id' });
  if (!TIMEFRAME_IDS.includes(timeframe)) return res.status(400).json({ error: `Unknown timeframe: ${timeframe}` });
  try {
    const detail = computePersonDetail(getState().normalized, role, id, timeframe, { from: req.query.from, to: req.query.to });
    res.json({ ...detail, timeframeLabel: TIMEFRAME_LABELS[timeframe] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

api.post('/refresh', async (req, res) => {
  await refresh();
  res.json({ ok: true, lastRefreshed: getState().lastRefreshed, lastError: getState().lastError });
});

app.use('/api', api);

// Serve the built frontend if present (production single-service deploy).
const webDist = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

app.listen(runtime.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] Solana Sales Dashboard API on http://localhost:${runtime.port}`);
  if (!runtime.mondayToken) {
    // eslint-disable-next-line no-console
    console.warn('[server] WARNING: MONDAY_API_TOKEN not set — /api/metrics will be empty.');
  }
  startAutoRefresh();
});
