import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics } from '../src/metrics.js';
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
      },
      // Subcontracting job (no soldDate): must NOT count toward sat/sold
      {
        id: 'i2', groupId: 'week1', leadGen: [LG_B], salesRep: [SR_A],
        dates: { assignedToLg: d('2026-06-05'), bookedDate: d('2026-06-06'), appointmentDate: d('2026-06-07'), soldDate: null, creationLog: d('2026-06-05') },
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

test('Divide-by-zero conversions return null (rendered as — in UI)', () => {
  const r = computeMetrics(dataset(), 'all_time');
  const b = r.leadGen.people.find((p) => p.id === '2');
  // B has sat=0 => sat->sold is null
  assert.equal(b.conv.satToSold, null);
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
