/**
 * Synthetic normalised board data for local preview/screenshots (MOCK=1).
 * NOT used in production — only when MONDAY_API_TOKEN is absent and MOCK=1.
 */
const d = (s) => new Date(`${s}T00:00:00Z`);
const reps = [
  ['100092316', 'Andrew Wagner'],
  ['96522094', 'Warren Thorogood'],
  ['101260808', 'David Martin'],
  ['32649560', 'Ben Miller'],
];
const gens = [
  ['99991377', 'Carraigh Murphy'],
  ['100909119', 'Clarence Smith'],
  ['96453154', 'Bradley Davey'],
];
const sources = ['Solar Quotes', 'TQC', 'Lead HQ | 21/01/26', 'Referral Program'];

function P([id, name]) {
  return [{ id, name }];
}

// Build a realistic June dataset.
export function buildMockNormalized() {
  const vcc = [];
  const sf = [];
  const iip = [];
  let n = 0;
  const day = (i) => `2026-06-${String((i % 27) + 1).padStart(2, '0')}`;

  // Leads assigned (VCC) — lots, spread across gens & sources.
  for (let i = 0; i < 140; i++) {
    const g = gens[i % gens.length];
    vcc.push({
      id: `v${i}`, groupId: 'g', leadGen: P(g), salesRep: [],
      leadSource: sources[i % sources.length], cpl: 40 + (i % 5) * 12,
      dates: { assignedToLg: d(day(i)), creationLog: d(day(i)) }, amounts: {},
    });
  }
  // Booked appointments (Sales Funnel).
  const POST_SAT = ['group_mm3zhb33', 'new_group41259', 'new_group35090', 'new_group69484'];
  for (let i = 0; i < 90; i++) {
    const g = gens[i % gens.length];
    const r = reps[i % reps.length];
    const sat = i % 3 !== 0; // ~2/3 sat
    sf.push({
      id: `s${i}`, groupId: sat ? POST_SAT[i % POST_SAT.length] : 'pre', leadGen: P(g), salesRep: P(r),
      leadSource: sources[i % sources.length], cpl: 45 + (i % 4) * 10,
      dates: { assignedToLg: d(day(i)), bookedDate: d(day(i)), appointmentDate: d(day(i + 2)), creationLog: d(day(i)) },
      amounts: {},
    });
  }
  // Sold deals (Installations) — Solana sales w/ revenue.
  const dealValues = [12890, 13197, 30000, 21164, 15000, 17354, 27844, 14000, 17903, 19986, 17575, 24300, 9800, 31200, 16450, 22100];
  for (let i = 0; i < 16; i++) {
    const g = gens[i % gens.length];
    const r = reps[i % reps.length];
    const rev = dealValues[i];
    iip.push({
      id: `i${i}`, groupId: `week${i}`, leadGen: P(g), salesRep: P(r),
      leadSource: sources[i % sources.length], cpl: 50,
      dates: {
        assignedToLg: d(day(i)), bookedDate: d(day(i)), appointmentDate: d(day(i + 1)),
        soldDate: d(day(i + 3)), creationLog: d(day(i)),
      },
      amounts: { revenue: rev, grossProfit: Math.round(rev * 0.32) },
    });
    n++;
  }
  // A couple of subcontracting jobs (no sold date) — must be ignored.
  iip.push({ id: 'sub1', groupId: 'sub', leadGen: [], salesRep: [], leadSource: null, cpl: null, dates: { creationLog: d('2026-06-02') }, amounts: {} });

  return { virtualCallCentre: vcc, salesFunnel: sf, installations: iip };
}
