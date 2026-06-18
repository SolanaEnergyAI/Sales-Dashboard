import React, { useState } from 'react';

const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-AU');
const LS_KEY = 'solana.targets';

function loadOverrides() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {};
  } catch {
    return {};
  }
}

export default function TargetsPanel({ monthly }) {
  const [overrides, setOverrides] = useState(loadOverrides);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ sold: '', revenue: '' });

  if (!monthly) return null;

  const target = {
    sold: overrides.sold ?? monthly.defaultTargets.sold,
    revenue: overrides.revenue ?? monthly.defaultTargets.revenue,
  };

  function openEdit() {
    setDraft({ sold: target.sold, revenue: target.revenue });
    setEditing(true);
  }
  function save() {
    const next = {
      sold: Number(draft.sold) || 0,
      revenue: Number(draft.revenue) || 0,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    setOverrides(next);
    setEditing(false);
  }
  function reset() {
    localStorage.removeItem(LS_KEY);
    setOverrides({});
    setEditing(false);
  }

  return (
    <div className="panel">
      <h2 className="panel-title">
        Monthly Targets — {monthly.label}
        <span className="targets-day">Day {monthly.daysElapsed}/{monthly.daysInMonth}</span>
        <span className="spacer" />
        {!editing && (
          <button className="link-btn" onClick={openEdit}>✎ Set targets</button>
        )}
      </h2>

      {editing ? (
        <div className="targets-edit">
          <label>
            Sold target
            <input type="number" value={draft.sold} onChange={(e) => setDraft((d) => ({ ...d, sold: e.target.value }))} />
          </label>
          <label>
            Revenue target ($)
            <input type="number" value={draft.revenue} onChange={(e) => setDraft((d) => ({ ...d, revenue: e.target.value }))} />
          </label>
          <button className="btn-save" onClick={save}>Save</button>
          <button className="link-btn" onClick={reset}>Reset to default</button>
          <button className="link-btn" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div className="targets-grid">
          <TargetBar label="Sold" actual={monthly.actual.sold} target={target.sold} pace={monthly.pace} />
          <TargetBar label="Revenue" actual={monthly.actual.revenue} target={target.revenue} pace={monthly.pace} fmt={money} />
        </div>
      )}
    </div>
  );
}

function TargetBar({ label, actual, target, pace, fmt = (v) => v }) {
  const pctRaw = target > 0 ? (actual / target) * 100 : 0;
  const pct = Math.round(pctRaw * 10) / 10;
  const width = Math.min(100, pctRaw);
  // On pace if progress % >= elapsed % of month.
  const onTrack = pctRaw >= pace;
  const projected = pace > 0 ? Math.round((actual / pace) * 100) : 0;

  return (
    <div className="target">
      <div className="target-head">
        <span className="target-label">{label}</span>
        <span className="target-vals">
          <b>{fmt(actual)}</b> <span className="muted-sep">/ {fmt(target)}</span>
        </span>
      </div>
      <div className="target-track">
        <div className={onTrack ? 'target-fill on' : 'target-fill off'} style={{ width: `${width}%` }} />
        <div className="target-pace" style={{ left: `${Math.min(100, pace)}%` }} title={`Pace marker — day ${pace}% of month`} />
      </div>
      <div className="target-foot">
        <span className={onTrack ? 'pill on' : 'pill off'}>{onTrack ? 'On track' : 'Behind pace'}</span>
        <span className="muted">{pct}% of goal · proj. {fmt(projected)}</span>
      </div>
    </div>
  );
}
