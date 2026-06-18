import React, { useCallback, useEffect, useState } from 'react';
import { fetchMeta, fetchMetrics, fetchHealth, triggerRefresh } from './api.js';
import KpiCards from './components/KpiCards.jsx';
import ConversionPanel from './components/ConversionPanel.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import RepChart from './components/RepChart.jsx';
import LeadSourcePanel from './components/LeadSourcePanel.jsx';

const POLL_MS = 60000;

export default function App() {
  const [meta, setMeta] = useState(null);
  const [role, setRole] = useState('leadGen');
  const [timeframe, setTimeframe] = useState('this_month');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMeta().then(setMeta).catch((e) => setError(e.message));
  }, []);

  const load = useCallback(async () => {
    if (timeframe === 'custom' && (!custom.from || !custom.to)) return;
    setLoading(true);
    try {
      const [m, h] = await Promise.all([
        fetchMetrics({ timeframe, from: custom.from, to: custom.to }),
        fetchHealth(),
      ]);
      setData(m);
      setHealth(h);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [timeframe, custom]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await triggerRefresh();
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const roleData = data?.[role];
  const conversionLabels = meta?.conversionLabels || {};

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">☀️</span>
          <div>
            <div className="brand-title">Solana Energy</div>
            <div className="brand-sub">Live Sales Metrics Dashboard</div>
          </div>
        </div>
        <div className="status">
          {health?.lastError && <span className="badge badge-error">Sync error</span>}
          <span className="muted">
            {health?.lastRefreshed
              ? `Synced ${new Date(health.lastRefreshed).toLocaleString()}`
              : 'Awaiting first sync…'}
          </span>
          <button className="btn" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </header>

      {error && <div className="error-banner">⚠ {error}</div>}
      {health && !health.tokenConfigured && (
        <div className="error-banner">
          MONDAY_API_TOKEN is not configured on the server — metrics will be empty. Add it to
          <code> server/.env</code> and restart.
        </div>
      )}

      <div className="controls">
        <div className="role-tabs">
          <button
            className={role === 'leadGen' ? 'tab active' : 'tab'}
            onClick={() => setRole('leadGen')}
          >
            Lead Gen
          </button>
          <button
            className={role === 'salesRep' ? 'tab active' : 'tab'}
            onClick={() => setRole('salesRep')}
          >
            Sales Rep
          </button>
        </div>

        <div className="timeframe-row">
          {(meta?.timeframes || []).map((tf) => (
            <button
              key={tf.id}
              className={timeframe === tf.id ? 'chip active' : 'chip'}
              onClick={() => setTimeframe(tf.id)}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {timeframe === 'custom' && (
          <div className="custom-range">
            <label>
              From
              <input
                type="date"
                value={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              />
            </label>
          </div>
        )}
      </div>

      {data && (
        <div className="timeframe-caption">
          Showing <strong>{data.timeframeLabel}</strong>
          {loading && <span className="muted"> · updating…</span>}
        </div>
      )}

      {roleData ? (
        <main className="content">
          <KpiCards totals={roleData.totals} />
          <ConversionPanel role={role} totals={roleData.totals} labels={conversionLabels} />
          <RepChart people={roleData.people} />
          <Leaderboard role={role} people={roleData.people} />
          <LeadSourcePanel sources={data.leadSources} />
        </main>
      ) : (
        <div className="loading">{error ? 'Unable to load metrics.' : 'Loading metrics…'}</div>
      )}

      <footer className="footer">
        Data source: Monday.com CRM · Virtual Call Centre → Sales Funnel → Installations In Progress
        {health?.timezone ? ` · ${health.timezone}` : ''}
      </footer>
    </div>
  );
}
