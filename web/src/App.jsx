import React, { useCallback, useEffect, useState } from 'react';
import { fetchMeta, fetchMetrics, fetchHealth, triggerRefresh } from './api.js';
import { exportCsv } from './export.js';
import KpiCards from './components/KpiCards.jsx';
import ConversionPanel from './components/ConversionPanel.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import RepChart from './components/RepChart.jsx';
import LeadSourcePanel from './components/LeadSourcePanel.jsx';
import LeadSourceChart from './components/LeadSourceChart.jsx';
import TrendChart from './components/TrendChart.jsx';

const POLL_MS = 60000;

function timeAgo(iso) {
  if (!iso) return null;
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

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
  const dotClass = health?.lastError ? 'dot err' : 'dot';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="logo-mark" src="/solana-mark.svg" alt="Solana Energy" />
          <div>
            <div className="brand-title">
              SOLANA <span className="brand-thin">Energy</span>
            </div>
            <div className="brand-sub">Live Sales Metrics Dashboard</div>
          </div>
        </div>
        <div className="status">
          <span className="sync">
            <span className={dotClass} />
            {health?.lastError
              ? 'Sync error'
              : health?.lastRefreshed
                ? `Synced ${timeAgo(health.lastRefreshed)}`
                : 'Awaiting sync…'}
          </span>
          <button className="btn ghost" onClick={() => exportCsv({ data, role })} disabled={!data}>
            ⤓ Export CSV
          </button>
          <button className="btn" onClick={onRefresh} disabled={refreshing}>
            <span className={refreshing ? 'spin' : ''}>↻</span>
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className="banner banner-error">⚠ {error}</div>}
      {health && !health.tokenConfigured && (
        <div className="banner banner-warn">
          <span>⚙</span>
          <span>
            <code>MONDAY_API_TOKEN</code> isn't configured on the server, so metrics are empty. Add it
            to <code>server/.env</code> and restart.
          </span>
        </div>
      )}

      <div className="controls">
        <div className="segmented">
          <button className={role === 'leadGen' ? 'active' : ''} onClick={() => setRole('leadGen')}>
            Lead Gen
          </button>
          <button className={role === 'salesRep' ? 'active' : ''} onClick={() => setRole('salesRep')}>
            Sales Rep
          </button>
        </div>
        <span className="spacer" />
        <div className="timeframes">
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
      </div>

      {timeframe === 'custom' && (
        <div className="custom-range">
          <label>
            From
            <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          </label>
          <label>
            To
            <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </label>
        </div>
      )}

      {data && (
        <div className="timeframe-caption">
          <span className="live">● Live</span> &nbsp;· Showing <strong>{data.timeframeLabel}</strong> ·{' '}
          {role === 'leadGen' ? 'Lead Gen' : 'Sales Rep'} view
          {loading && <span> · updating…</span>}
        </div>
      )}

      {roleData ? (
        <main>
          <KpiCards totals={roleData.totals} compare={roleData.compare} />
          <div className="grid-2">
            <ConversionPanel role={role} totals={roleData.totals} labels={conversionLabels} />
            <RepChart people={roleData.people} />
          </div>
          <TrendChart trend={data.trend} />
          <Leaderboard role={role} people={roleData.people} />
          <div className="grid-2">
            <LeadSourceChart sources={data.leadSources} />
            <LeadSourcePanel sources={data.leadSources} />
          </div>
        </main>
      ) : error ? (
        <div className="loading">Unable to load metrics.</div>
      ) : (
        <div className="skeleton-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="skeleton" key={i} />
          ))}
        </div>
      )}

      <footer className="footer">
        Data source: Monday.com CRM · <span className="pipe">Virtual Call Centre → Sales Funnel → Installations</span>
        {health?.timezone ? ` · ${health.timezone}` : ''}
      </footer>
    </div>
  );
}
