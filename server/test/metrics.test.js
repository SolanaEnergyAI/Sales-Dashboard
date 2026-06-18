import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics, computePersonDetail } from '../src/metrics.js';
import { SALES_FUNNEL_POST_SAT_GROUPS } from '../src/config.js';

const LG_A = { id: '1', name: 'Lead Gen A' };
const LG_B = { id: '2', name: 'Lead Gen B' };
const SR_A = { id: '10', name: 'Rep A' };
const POST_SAT_GROUP = SALES_FUNNEL_POST_SAT_GROUPS[0];

const d = (s) => new Date(`${s}T00:00:00Z`);

// Build a synthetic, fully-controlled dataset (no Monday needed).
function dataset() {
  return {
    virtualCallCentre: [
      // LG A assigned a lead in VCC
      { id: 'v1', groupId: 'g', leadGen: [LG_A], salesRep: [], dates: { assignedToLg: d('2026-06-10'), creationLog: d('2026-06-10') } },
      // LG B assigned a lead in VCC
      { id: 'v2', groupId: 'g', leadGen: [LG_B], salesRep: [], dates: { assignedToLg: d('2026-06-11'), creationLog: d('2026-06-11') } },
    ],
    salesFunnel: [
      // LG A booked + SR A assigned; in a PRE-sat group => NOT sat
      {
        id: 's1', groupId: 'pre_sat_group', leadGen: [LG_A], salesRep: [SR_A],
        dates: { assignedToLg: d('2026-06-09'), bookedDate: d('2026-06-12'), appointmentDate: d('2026-06-15'), creationLog: d('2026-06-09') },
      },
      // LG A booked + SR A; in a POST-sat group => sat
      {
        id: 's2', groupId: POST_SAT_GROUP, leadGen: [LG_A], salesRep: [SR_A],
        dates: { assignedToLg: d('2026-06-08'), bookedDate: d('2026-06-13'), appointmentDate: d('2026-06-16'), creationLog: d('2026-06-08') },
      },
    ],
    installations: [
      // Solana sale (soldDate filled): counts for assigned/booked/sat/sold
      {
        id: 'i1', groupId: 'week1', leadGen: [LG_A], salesRep: [SR_A],
        dates: { assignedToLg: d('2026-06-05'), bookedDate: d('2026-06-06'), appointmentDate: d('2026-06-07'), soldDate: d('2026-06-14'), creationLog: d('2026-06-05') },
        amounts: { revenue: 20000, grossProfit: 5000 },
      },
      // Subcontracting job (no soldDate): must NOT count toward sat/sold/$
      {
        id: 'i2', groupId: 'week1', leadGen: [LG_B], salesRep: [SR_A],
        dates: { assignedToLg: d('2026-06-05'), bookedDate: d('2026-06-06'), appointmentDate: d('2026-06-07'), soldDate: null, creationLog: d('2026-06-05') },
        amounts: { revenue: 99999, grossProfit: 99999 },
      },
    ],
  };
}

test('Lead Gen quantity metrics aggregate across boards with correct filters', () => {
  const r = computeMetrics(dataset(), 'all_time');
  const lg = r.leadGen;
  const a = lg.people.find((p) => p.id === '1');
  const b = lg.people.find((p) => p.id === '2');

  // LG A assigned: v1 (VCC) + s1,s2 (SF) + i1 (IIP) = 4
  assert.equal(a.assigned, 4);
  // LG A booked: s1,s2 (SF) + i1 (IIP) = 3
  assert.equal(a.booked, 3);
  // LG A sat: s2 (post-sat SF) + i1 (IIP, sold filled) = 2  (s1 is pre-sat, excluded)
  assert.equal(a.sat, 2);
  // LG A sold: i1 = 1
  assert.equal(a.sold, 1);

  // LG B assigned: v2 (VCC) + i2 (IIP) = 2
  assert.equal(b.assigned, 2);
  // LG B sat: i2 has no soldDate => 0
  assert.equal(b.sat, 0);
  // LG B sold: 0
  assert.equal(b.sold, 0);

  // Totals
  assert.equal(lg.totals.assigned, 6);
  assert.equal(lg.totals.sold, 1);
});

test('Sales Rep metrics use Booked Date for assigned and exclude subcontracting', () => {
  const r = computeMetrics(dataset(), 'all_time');
  const rep = r.salesRep.people.find((p) => p.id === '10');
  // SR assigned (booked date): s1,s2 (SF) + i1,i2 (IIP) = 4
  assert.equal(rep.assigned, 4);
  // SR sat: s2 (post-sat) + i1 (sold filled) = 2
  assert.equal(rep.sat, 2);
  // SR sold: i1 = 1
  assert.equal(rep.sold, 1);
});

test('Conversion percentages divide cohort counts and round to one decimal', () => {
  const r = computeMetrics(dataset(), 'all_time');
  const a = r.leadGen.people.find((p) => p.id === '1');
  // assigned=4 booked=3 sat=2 sold=1 (same under creation-log cohort here)
  assert.equal(a.conv.assignedToBooked, 75); // 3/4
  assert.equal(a.conv.assignedToSat, 50); // 2/4
  assert.equal(a.conv.assignedToSold, 25); // 1/4
  assert.equal(a.conv.satToSold, 50); // 1/2
});

test('Revenue & gross profit sum only sold deals, by person', () => {
  const r = computeMetrics(dataset(), 'all_time');
  // Only i1 is sold (i2 has no Sold Date) -> revenue 20000, GP 5000.
  assert.equal(r.leadGen.totals.revenue, 20000);
  assert.equal(r.leadGen.totals.grossProfit, 5000);
  assert.equal(r.salesRep.totals.revenue, 20000);

  const a = r.leadGen.people.find((p) => p.id === '1');
  assert.equal(a.revenue, 20000);
  assert.equal(a.grossProfit, 5000);

  // LG_B only owns the subcontracting job -> no revenue.
  const b = r.leadGen.people.find((p) => p.id === '2');
  assert.equal(b.revenue, 0);
});

test('A sale is verified ONLY by a Sold Date — dynamic on presence', () => {
  // Same item, toggled: no Sold Date -> not a sale; Sold Date set -> counts.
  const make = (soldDate) => ({
    virtualCallCentre: [],
    salesFunnel: [],
    installations: [
      {
        id: 'x', groupId: 'g', leadGen: [LG_A], salesRep: [SR_A],
        dates: { bookedDate: d('2026-06-02'), appointmentDate: d('2026-06-05'), soldDate, creationLog: d('2026-06-01') },
        amounts: { revenue: 10000, grossProfit: 2000 },
      },
    ],
  });

  const unsold = computeMetrics(make(null), 'all_time');
  assert.equal(unsold.leadGen.totals.sold, 0);
  assert.equal(unsold.leadGen.totals.revenue, 0);
  assert.equal(unsold.salesRep.totals.sat, 0); // IIP "sat" also requires a Sold Date

  const sold = computeMetrics(make(d('2026-06-10')), 'all_time');
  assert.equal(sold.leadGen.totals.sold, 1);
  assert.equal(sold.leadGen.totals.revenue, 10000);
  assert.equal(sold.salesRep.totals.sat, 1);
});

test('Divide-by-zero conversions return null (rendered as — in UI)', () => {
  const r = computeMetrics(dataset(), 'all_time');
  const b = r.leadGen.people.find((p) => p.id === '2');
  // B has sat=0 => sat->sold is null
  assert.equal(b.conv.satToSold, null);
});

test('Lead Source report aggregates leads, sold, revenue, spend by channel', () => {
  const data = {
    virtualCallCentre: [
      { id: 'v1', groupId: 'g', leadGen: [LG_A], salesRep: [], leadSource: 'Solar Quotes', cpl: 50, dates: { assignedToLg: d('2026-06-10'), creationLog: d('2026-06-10') }, amounts: {} },
      { id: 'v2', groupId: 'g', leadGen: [LG_B], salesRep: [], leadSource: 'TQC', cpl: 30, dates: { assignedToLg: d('2026-06-11'), creationLog: d('2026-06-11') }, amounts: {} },
      { id: 'v3', groupId: 'g', leadGen: [LG_A], salesRep: [], leadSource: 'Solar Quotes', cpl: 70, dates: { assignedToLg: d('2026-06-12'), creationLog: d('2026-06-12') }, amounts: {} },
    ],
    salesFunnel: [],
    installations: [
      { id: 'i1', groupId: 'w', leadGen: [LG_A], salesRep: [SR_A], leadSource: 'Solar Quotes', cpl: null, dates: { soldDate: d('2026-06-14'), creationLog: d('2026-06-05') }, amounts: { revenue: 25000, grossProfit: 6000 } },
    ],
  };
  const r = computeMetrics(data, 'all_time');
  const sq = r.leadSources.find((s) => s.source === 'Solar Quotes');
  const tqc = r.leadSources.find((s) => s.source === 'TQC');

  assert.equal(sq.leads, 2); // v1 + v3
  assert.equal(sq.sold, 1); // i1
  assert.equal(sq.revenue, 25000);
  assert.equal(sq.spend, 120); // 50 + 70
  assert.equal(sq.avgCpl, 60); // 120 / 2
  assert.equal(sq.convRate, 50); // 1 sold / 2 leads

  assert.equal(tqc.leads, 1);
  assert.equal(tqc.sold, 0);
  assert.equal(tqc.convRate, 0);

  // Sorted by revenue desc -> Solar Quotes first.
  assert.equal(r.leadSources[0].source, 'Solar Quotes');
});

test('Previous-period comparison computes deltas on totals', () => {
  // One sold deal in May, two in June; compare June vs May.
  const lg = [{ id: 'A', name: 'A' }];
  const sr = [{ id: 'S', name: 'S' }];
  const sale = (id, soldDate, rev) => ({
    id, groupId: 'w', leadGen: lg, salesRep: sr, leadSource: 'TQC', cpl: null,
    dates: { soldDate: d(soldDate), creationLog: d(soldDate) }, amounts: { revenue: rev, grossProfit: 0 },
  });
  const data = {
    virtualCallCentre: [], salesFunnel: [],
    installations: [sale('m1', '2026-05-10', 10000), sale('j1', '2026-06-05', 10000), sale('j2', '2026-06-20', 10000)],
  };
  const now = new Date('2026-06-15T00:00:00Z');
  const r = computeMetrics(data, 'this_month', {}, now);

  assert.equal(r.leadGen.totals.sold, 2); // June
  assert.ok(r.leadGen.compare, 'comparison present');
  assert.equal(r.leadGen.compare.sold.previous, 1); // May
  assert.equal(r.leadGen.compare.sold.delta, 100); // 1 -> 2 = +100%
  assert.equal(r.leadGen.compare.revenue.delta, 100); // 10k -> 20k
});

test('All-time has no previous comparison', () => {
  const r = computeMetrics(dataset(), 'all_time');
  assert.equal(r.previousRange, null);
  assert.equal(r.leadGen.compare, undefined);
});

test('6-month trend buckets sold + revenue by month', () => {
  const sale = (id, soldDate, rev) => ({
    id, groupId: 'w', leadGen: [], salesRep: [], leadSource: 'TQC', cpl: null,
    dates: { soldDate: d(soldDate), bookedDate: d(soldDate), creationLog: d(soldDate) },
    amounts: { revenue: rev, grossProfit: 0 },
  });
  const data = {
    virtualCallCentre: [], salesFunnel: [],
    installations: [sale('a', '2026-05-10', 10000), sale('b', '2026-06-05', 12000), sale('c', '2026-06-25', 8000)],
  };
  const now = new Date('2026-06-15T00:00:00Z');
  const r = computeMetrics(data, 'this_month', {}, now);

  assert.equal(r.trend.length, 6);
  const last = r.trend[r.trend.length - 1]; // June
  const prev = r.trend[r.trend.length - 2]; // May
  assert.equal(last.label, 'Jun');
  assert.equal(last.sold, 2);
  assert.equal(last.revenue, 20000);
  assert.equal(prev.label, 'May');
  assert.equal(prev.sold, 1);
  assert.equal(prev.revenue, 10000);
});

test('Monthly target progress reflects current-month actuals only', () => {
  const sale = (id, sd, rev) => ({
    id, groupId: 'w', leadGen: [], salesRep: [], leadSource: 'TQC', cpl: null,
    dates: { soldDate: d(sd), creationLog: d(sd) }, amounts: { revenue: rev, grossProfit: 0 },
  });
  const data = {
    virtualCallCentre: [], salesFunnel: [],
    installations: [sale('a', '2026-06-05', 10000), sale('b', '2026-06-20', 15000), sale('c', '2026-05-30', 9999)],
  };
  const now = new Date('2026-06-15T00:00:00Z');
  const r = computeMetrics(data, 'all_time', {}, now); // monthly is independent of timeframe
  assert.equal(r.monthly.actual.sold, 2); // only June deals
  assert.equal(r.monthly.actual.revenue, 25000);
  assert.equal(r.monthly.daysInMonth, 30);
  assert.equal(r.monthly.daysElapsed, 15);
  assert.ok(r.monthly.defaultTargets.sold > 0);
});

test('Person drill-down returns deals, sources and summary for one person', () => {
  const detail = computePersonDetail(dataset(), 'leadGen', '1', 'all_time');
  assert.equal(detail.name, 'Lead Gen A');
  assert.equal(detail.role, 'leadGen');
  assert.equal(detail.counterRole, 'salesRep');
  assert.equal(detail.summary.sold, 1); // i1 only
  assert.equal(detail.deals.length, 1);
  assert.equal(detail.deals[0].counterpart, 'Rep A'); // the Sales Rep on the deal
  assert.equal(detail.deals[0].revenue, 20000);
  assert.equal(detail.sources[0].sold, 1);
  assert.equal(detail.trend.length, 6);
});

test('Timeframe filtering narrows the window', () => {
  // Only items whose own date column falls in June 14-16 should count for some.
  const r = computeMetrics(dataset(), 'custom', { from: '2026-06-14', to: '2026-06-16' });
  const lg = r.leadGen.totals;
  // sold date 2026-06-14 (i1) in range => sold total 1
  assert.equal(lg.sold, 1);
  // assigned dates are all before June 14 => assigned total 0
  assert.equal(lg.assigned, 0);
});
