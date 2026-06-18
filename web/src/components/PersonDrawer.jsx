import React, { useEffect } from 'react';

const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-AU');
const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

export default function PersonDrawer({ open, loading, detail, error, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const maxRev = Math.max(1, ...((detail?.trend || []).map((t) => t.revenue)));
  const s = detail?.summary;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="drawer-name">{detail?.name || 'Loading…'}</div>
            <div className="drawer-role">
              {detail ? (detail.role === 'leadGen' ? 'Lead Gen' : 'Sales Rep') : ''}
              {detail ? ` · ${detail.timeframeLabel}` : ''}
            </div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {error && <div className="banner banner-error" style={{ margin: 16 }}>⚠ {error}</div>}
        {loading && !detail && <div className="loading">Loading…</div>}

        {detail && (
          <div className="drawer-body">
            <div className="mini-kpis">
              <Mini label="Sold" value={s.sold} />
              <Mini label="Revenue" value={money(s.revenue)} />
              <Mini label="Sat" value={s.sat} />
              <Mini label="Booked" value={s.booked} />
            </div>

            <h3 className="drawer-section">Personal trend (6 mo)</h3>
            <div className="spark">
              {detail.trend.map((t) => (
                <div className="spark-col" key={t.label} title={`${t.label}: ${t.sold} sold · ${money(t.revenue)}`}>
                  <div className="spark-bar" style={{ height: `${Math.round((t.revenue / maxRev) * 100)}%` }} />
                  <span className="spark-label">{t.label}</span>
                </div>
              ))}
            </div>

            <h3 className="drawer-section">By lead source</h3>
            {detail.sources.length === 0 ? (
              <p className="empty">No sold deals in this timeframe.</p>
            ) : (
              <table className="board-table compact">
                <thead><tr><th>Source</th><th className="num">Sold</th><th className="num">Revenue</th></tr></thead>
                <tbody>
                  {detail.sources.map((src) => (
                    <tr key={src.source}><td>{src.source}</td><td className="num">{src.sold}</td><td className="num">{money(src.revenue)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}

            <h3 className="drawer-section">Sold deals ({detail.deals.length})</h3>
            {detail.deals.length === 0 ? (
              <p className="empty">No sold deals in this timeframe.</p>
            ) : (
              <table className="board-table compact">
                <thead>
                  <tr>
                    <th>Sold</th>
                    <th>{detail.counterRole === 'leadGen' ? 'Lead Gen' : 'Sales Rep'}</th>
                    <th>Source</th>
                    <th className="num">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.deals.map((dl) => (
                    <tr key={dl.id}>
                      <td>{dl.soldDate}</td>
                      <td>{dl.counterpart}</td>
                      <td className="conv">{dl.source}</td>
                      <td className="num">{money(dl.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="mini-kpi">
      <div className="mini-val">{value}</div>
      <div className="mini-label">{label}</div>
    </div>
  );
}
