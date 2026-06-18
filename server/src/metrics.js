/**
 * Metric engine — implements every Lead Gen & Sales Rep metric from the
 * Solana Energy "Lead to Sale" workflow manual, for any timeframe.
 *
 * QUANTITY metrics (totals) are counted using each metric's OWN date column
 *   (e.g. LG Assigned -> "Assigned to LG", LG Sold -> "Sold Date").
 *
 * CONVERSION metrics (percentages) are counted using the "Creation Log" date
 *   for BOTH numerator and denominator, per the manual's "Static Batch
 *   Conversion" spec ("Date Filter Column: Creation Log ... filter by Creation
 *   Log in all boards"). This keeps each conversion within one creation cohort.
 *
 * Because an item physically lives in exactly one board at a time (it moves
 * VCC -> Sales Funnel -> Installations), summing a metric across boards never
 * double-counts a lead.
 */
import {
  COLUMNS,
  BOARDS,
  SALES_FUNNEL_POST_SAT_GROUPS,
} from './config.js';
import { parsers } from './mondayClient.js';
import { resolveTimeframe, previousRange, isWithin } from './timeframes.js';

const BOARD_KEYS = {
  [BOARDS.virtualCallCentre]: 'virtualCallCentre',
  [BOARDS.salesFunnel]: 'salesFunnel',
  [BOARDS.installations]: 'installations',
};

/**
 * Normalise one board's raw items into a friendly shape:
 *   { id, groupId, leadGen:[{id,name}], salesRep:[{id,name}],
 *     dates: { assignedToLg, bookedDate, appointmentDate, soldDate, creationLog } }
 */
export function normalizeBoard(boardId, rawItems, usersById) {
  const key = BOARD_KEYS[boardId];
  const map = COLUMNS[key];
  return rawItems.map((item) => {
    const c = item.columns;
    const dates = {};
    if (map.assignedToLg) dates.assignedToLg = parsers.parseDate(c[map.assignedToLg]);
    if (map.bookedDate) dates.bookedDate = parsers.parseDate(c[map.bookedDate]);
    if (map.appointmentDate) dates.appointmentDate = parsers.parseDate(c[map.appointmentDate]);
    if (map.soldDate) dates.soldDate = parsers.parseDate(c[map.soldDate]);
    // Prefer the configured creation_log column; fall back to item.created_at.
    dates.creationLog =
      (map.creationLog && parsers.parseDate(c[map.creationLog])) ||
      parseCreationLogText(c[map.creationLog]) ||
      item.createdAt ||
      null;
    const amounts = {
      revenue: map.revenue ? parsers.parseNumber(c[map.revenue]) : null,
      grossProfit: map.grossProfit ? parsers.parseNumber(c[map.grossProfit]) : null,
    };
    return {
      id: item.id,
      groupId: item.groupId,
      leadGen: map.leadGen ? parsers.parsePeople(c[map.leadGen], usersById) : [],
      salesRep: map.salesRep ? parsers.parsePeople(c[map.salesRep], usersById) : [],
      // Lead Source is a status column — its label is the column's `text`.
      leadSource: map.leadSource ? c[map.leadSource]?.text || null : null,
      cpl: map.cpl ? parsers.parseNumber(c[map.cpl]) : null,
      dates,
      amounts,
    };
  });
}

/** creation_log column values sometimes only expose a text "YYYY-MM-DD HH:mm:ss UTC". */
function parseCreationLogText(cv) {
  if (!cv) return null;
  // value JSON first
  if (cv.value) {
    try {
      const v = JSON.parse(cv.value);
      const raw = v?.created_at || v?.changed_at;
      if (raw) {
        const d = new Date(Number.isFinite(raw) ? raw * 1000 : raw);
        if (!Number.isNaN(d.getTime())) return d;
      }
    } catch {
      /* fall through */
    }
  }
  if (cv.text) {
    const d = new Date(cv.text.replace(' UTC', 'Z').replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Metric source descriptors. Each base metric is the sum of one or more board
 * sources. `dateField` is used for the QUANTITY pass; the CONVERSION pass swaps
 * it for `creationLog`. `groups` / `requireSold` narrow which items qualify.
 */
const POST_SAT = new Set(SALES_FUNNEL_POST_SAT_GROUPS);

const SOURCES = {
  leadGen: {
    assigned: [
      { board: 'virtualCallCentre', dateField: 'assignedToLg' },
      { board: 'salesFunnel', dateField: 'assignedToLg' },
      { board: 'installations', dateField: 'assignedToLg' },
    ],
    booked: [
      { board: 'salesFunnel', dateField: 'bookedDate' },
      { board: 'installations', dateField: 'bookedDate' },
    ],
    sat: [
      { board: 'salesFunnel', dateField: 'appointmentDate', groups: POST_SAT },
      { board: 'installations', dateField: 'appointmentDate', requireSold: true },
    ],
    sold: [{ board: 'installations', dateField: 'soldDate' }],
  },
  salesRep: {
    // For a Sales Rep "Assigned" == when the appointment was booked to them.
    assigned: [
      { board: 'salesFunnel', dateField: 'bookedDate' },
      { board: 'installations', dateField: 'bookedDate' },
    ],
    booked: [
      { board: 'salesFunnel', dateField: 'bookedDate' },
      { board: 'installations', dateField: 'bookedDate' },
    ],
    sat: [
      { board: 'salesFunnel', dateField: 'appointmentDate', groups: POST_SAT },
      { board: 'installations', dateField: 'appointmentDate', requireSold: true },
    ],
    sold: [{ board: 'installations', dateField: 'soldDate' }],
  },
};

/** Conversion definitions: [label] -> [numeratorMetric, denominatorMetric]. */
const CONVERSIONS = {
  leadGen: {
    assignedToBooked: ['booked', 'assigned'],
    assignedToSat: ['sat', 'assigned'],
    assignedToSold: ['sold', 'assigned'],
    bookedToSat: ['sat', 'booked'],
    bookedToSold: ['sold', 'booked'],
    satToSold: ['sold', 'sat'],
  },
  salesRep: {
    assignedToSat: ['sat', 'assigned'],
    assignedToSold: ['sold', 'assigned'],
    bookedToSat: ['sat', 'booked'],
    bookedToSold: ['sold', 'booked'],
    satToSold: ['sold', 'sat'],
  },
};

const BASE_METRICS = ['assigned', 'booked', 'sat', 'sold'];

function itemQualifies(item, source, dateField, range) {
  if (source.groups && !(item.groupId && source.groups.has(item.groupId))) return false;
  if (source.requireSold && !item.dates.soldDate) return false;
  const date = item.dates[dateField];
  return isWithin(date, range);
}

/**
 * Count a single base metric for a role, returning { total, perPerson: Map }.
 * `useCreationLog` switches the date basis to Creation Log (conversion cohort).
 */
function countMetric(normalized, role, metric, range, useCreationLog) {
  const perPerson = new Map(); // personId -> { name, count }
  let total = 0;
  for (const source of SOURCES[role][metric]) {
    const items = normalized[source.board];
    const dateField = useCreationLog ? 'creationLog' : source.dateField;
    for (const item of items) {
      if (!itemQualifies(item, source, dateField, range)) continue;
      total += 1;
      for (const person of item[role]) {
        const cur = perPerson.get(person.id) || { name: person.name, count: 0 };
        cur.count += 1;
        perPerson.set(person.id, cur);
      }
    }
  }
  return { total, perPerson };
}

/**
 * Sum the $ amounts (revenue, gross profit) of SOLD deals in the timeframe,
 * by person, for a role. Mirrors the `sold` source (Installations, Sold Date).
 */
function sumSoldAmounts(normalized, role, range) {
  const perPerson = new Map(); // personId -> { name, revenue, grossProfit }
  const total = { revenue: 0, grossProfit: 0 };
  for (const source of SOURCES[role].sold) {
    const items = normalized[source.board];
    for (const item of items) {
      if (!itemQualifies(item, source, source.dateField, range)) continue;
      const rev = item.amounts?.revenue || 0;
      const gp = item.amounts?.grossProfit || 0;
      total.revenue += rev;
      total.grossProfit += gp;
      for (const person of item[role]) {
        const cur = perPerson.get(person.id) || { name: person.name, revenue: 0, grossProfit: 0 };
        cur.revenue += rev;
        cur.grossProfit += gp;
        perPerson.set(person.id, cur);
      }
    }
  }
  return { total, perPerson };
}

function pct(numerator, denominator) {
  if (!denominator) return null; // avoid divide-by-zero; UI shows "—"
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal place
}

/**
 * Compute the full metric payload for one role and timeframe.
 * `normalized` is { virtualCallCentre, salesFunnel, installations } arrays.
 */
function computeRole(normalized, role, range) {
  // Quantity pass (own date columns) and cohort pass (creation log).
  const qty = {};
  const cohort = {};
  for (const metric of BASE_METRICS) {
    qty[metric] = countMetric(normalized, role, metric, range, false);
    cohort[metric] = countMetric(normalized, role, metric, range, true);
  }

  // Revenue / gross profit on sold deals (by Sold Date in range).
  const money = sumSoldAmounts(normalized, role, range);

  // Collect everyone who appears in any metric.
  const personIds = new Set();
  for (const metric of BASE_METRICS) {
    for (const id of qty[metric].perPerson.keys()) personIds.add(id);
    for (const id of cohort[metric].perPerson.keys()) personIds.add(id);
  }
  for (const id of money.perPerson.keys()) personIds.add(id);

  const convDefs = CONVERSIONS[role];
  const people = [];
  for (const id of personIds) {
    const row = { id, name: null };
    for (const metric of BASE_METRICS) {
      const entry = qty[metric].perPerson.get(id);
      row[metric] = entry ? entry.count : 0;
      if (entry) row.name = entry.name;
    }
    // Conversions use the creation-log cohort counts.
    row.conv = {};
    for (const [label, [num, den]] of Object.entries(convDefs)) {
      const n = cohort[num].perPerson.get(id)?.count || 0;
      const d = cohort[den].perPerson.get(id)?.count || 0;
      row.conv[label] = pct(n, d);
    }
    const m = money.perPerson.get(id);
    row.revenue = m ? Math.round(m.revenue) : 0;
    row.grossProfit = m ? Math.round(m.grossProfit) : 0;
    if (!row.name && m) row.name = m.name;
    if (!row.name) row.name = `User ${id}`;
    people.push(row);
  }
  people.sort((a, b) => b.sold - a.sold || b.revenue - a.revenue || b.assigned - a.assigned);

  const totals = {};
  for (const metric of BASE_METRICS) totals[metric] = qty[metric].total;
  totals.revenue = Math.round(money.total.revenue);
  totals.grossProfit = Math.round(money.total.grossProfit);
  totals.conv = {};
  for (const [label, [num, den]] of Object.entries(convDefs)) {
    totals.conv[label] = pct(cohort[num].total, cohort[den].total);
  }

  return { people, totals };
}

/**
 * Lead Source performance for a timeframe (channel ROI), independent of role:
 *   - leads:   items across all boards with "Assigned to LG" in range
 *   - sold:    Installations items sold in range (Sold Date)
 *   - revenue: Total Cash Price of those sold deals
 *   - spend:   sum of CPL across the leads (acquisition cost)
 *   - avgCpl:  spend / leads;  convRate: sold / leads
 */
function computeLeadSourceReport(normalized, range) {
  const bySource = new Map();
  const row = (src) => {
    const key = src || 'Unspecified';
    if (!bySource.has(key)) bySource.set(key, { source: key, leads: 0, sold: 0, revenue: 0, spend: 0 });
    return bySource.get(key);
  };

  // Leads acquired (Assigned to LG) across every board, with their CPL spend.
  for (const board of ['virtualCallCentre', 'salesFunnel', 'installations']) {
    for (const item of normalized[board]) {
      if (!isWithin(item.dates.assignedToLg, range)) continue;
      const r = row(item.leadSource);
      r.leads += 1;
      r.spend += item.cpl || 0;
    }
  }

  // Sales closed (Sold Date) + revenue, by the source carried on the deal.
  for (const item of normalized.installations) {
    if (!isWithin(item.dates.soldDate, range)) continue;
    const r = row(item.leadSource);
    r.sold += 1;
    r.revenue += item.amounts?.revenue || 0;
  }

  return [...bySource.values()]
    .map((r) => ({
      source: r.source,
      leads: r.leads,
      sold: r.sold,
      revenue: Math.round(r.revenue),
      spend: Math.round(r.spend),
      avgCpl: r.leads ? Math.round(r.spend / r.leads) : null,
      convRate: r.leads ? Math.round((r.sold / r.leads) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.sold - a.sold || b.leads - a.leads);
}

/**
 * Monthly trend for the last `months` calendar months (role-independent):
 * sold count + revenue (by Sold Date) and booked count (by Booked Date).
 */
function computeTrend(normalized, now, months = 6) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const ref = new Date(Date.UTC(y, m - i, 15));
    const range = resolveTimeframe('this_month', {}, ref);
    let sold = 0;
    let revenue = 0;
    let booked = 0;
    for (const it of normalized.installations) {
      if (isWithin(it.dates.soldDate, range)) {
        sold += 1;
        revenue += it.amounts?.revenue || 0;
      }
      if (isWithin(it.dates.bookedDate, range)) booked += 1;
    }
    for (const it of normalized.salesFunnel) {
      if (isWithin(it.dates.bookedDate, range)) booked += 1;
    }
    out.push({
      month: `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, '0')}`,
      label: new Date(Date.UTC(y, m - i, 1)).toLocaleString('en-AU', { month: 'short' }),
      sold,
      revenue: Math.round(revenue),
      booked,
    });
  }
  return out;
}

/**
 * Top-level: compute metrics for both roles for a timeframe.
 * @param {object} normalized board arrays keyed by board key
 * @param {string} timeframeId
 * @param {object} custom { from, to } for custom timeframe
 */
const COMPARE_KEYS = ['assigned', 'booked', 'sat', 'sold', 'revenue', 'grossProfit'];

function deltaPct(cur, prev) {
  if (!prev) return null; // no prior baseline -> no % (UI shows "new")
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

function totalsComparison(curTotals, prevTotals) {
  const out = {};
  for (const k of COMPARE_KEYS) {
    out[k] = {
      current: curTotals[k] || 0,
      previous: prevTotals[k] || 0,
      delta: deltaPct(curTotals[k] || 0, prevTotals[k] || 0),
    };
  }
  return out;
}

export function computeMetrics(normalized, timeframeId, custom = {}, now = new Date()) {
  const range = resolveTimeframe(timeframeId, custom, now);
  const leadGen = computeRole(normalized, 'leadGen', range);
  const salesRep = computeRole(normalized, 'salesRep', range);

  // Previous-period comparison for KPI deltas.
  const prev = previousRange(timeframeId, custom, now);
  if (prev) {
    leadGen.compare = totalsComparison(leadGen.totals, computeRole(normalized, 'leadGen', prev).totals);
    salesRep.compare = totalsComparison(salesRep.totals, computeRole(normalized, 'salesRep', prev).totals);
  }

  return {
    timeframe: timeframeId,
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    previousRange: prev ? { start: prev.start.toISOString(), end: prev.end.toISOString() } : null,
    leadGen,
    salesRep,
    leadSources: computeLeadSourceReport(normalized, range),
    trend: computeTrend(normalized, now, 6),
  };
}

function personMatches(item, role, personId) {
  return (item[role] || []).some((p) => p.id === personId);
}

/** Per-month sold + revenue for one person (their personal trend). */
function computePersonTrend(normalized, role, personId, now, months = 6) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const ref = new Date(Date.UTC(y, m - i, 15));
    const range = resolveTimeframe('this_month', {}, ref);
    let sold = 0;
    let revenue = 0;
    for (const it of normalized.installations) {
      if (!isWithin(it.dates.soldDate, range)) continue;
      if (!personMatches(it, role, personId)) continue;
      sold += 1;
      revenue += it.amounts?.revenue || 0;
    }
    out.push({
      label: new Date(Date.UTC(y, m - i, 1)).toLocaleString('en-AU', { month: 'short' }),
      sold,
      revenue: Math.round(revenue),
    });
  }
  return out;
}

/**
 * Drill-down detail for one person in a role + timeframe: their headline
 * totals, the sold deals they own, their sold-by-source split, and a personal
 * 6-month trend.
 */
export function computePersonDetail(normalized, role, personId, timeframeId, custom = {}, now = new Date()) {
  const range = resolveTimeframe(timeframeId, custom, now);
  const roleResult = computeRole(normalized, role, range);
  const summary = roleResult.people.find((p) => p.id === personId) || {
    id: personId, name: `User ${personId}`, assigned: 0, booked: 0, sat: 0, sold: 0, revenue: 0, grossProfit: 0, conv: {},
  };

  const counterRole = role === 'leadGen' ? 'salesRep' : 'leadGen';
  const deals = [];
  for (const it of normalized.installations) {
    if (!isWithin(it.dates.soldDate, range)) continue;
    if (!personMatches(it, role, personId)) continue;
    deals.push({
      id: it.id,
      soldDate: it.dates.soldDate.toISOString().slice(0, 10),
      revenue: it.amounts?.revenue || 0,
      grossProfit: it.amounts?.grossProfit || 0,
      source: it.leadSource || 'Unspecified',
      counterpart: it[counterRole]?.[0]?.name || '—',
    });
  }
  deals.sort((a, b) => b.revenue - a.revenue);

  const bySource = new Map();
  for (const dl of deals) {
    const r = bySource.get(dl.source) || { source: dl.source, sold: 0, revenue: 0 };
    r.sold += 1;
    r.revenue += dl.revenue;
    bySource.set(dl.source, r);
  }
  const sources = [...bySource.values()]
    .map((s) => ({ ...s, revenue: Math.round(s.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    id: personId,
    name: summary.name,
    role,
    counterRole,
    summary,
    deals,
    sources,
    trend: computePersonTrend(normalized, role, personId, now, 6),
  };
}

export const CONVERSION_LABELS = {
  assignedToBooked: 'Assigned → Booked',
  assignedToSat: 'Assigned → Sat',
  assignedToSold: 'Assigned → Sold',
  bookedToSat: 'Booked → Sat',
  bookedToSold: 'Booked → Sold',
  satToSold: 'Sat → Sold',
};

export const _internal = { countMetric, normalizeBoard, SOURCES, CONVERSIONS };
