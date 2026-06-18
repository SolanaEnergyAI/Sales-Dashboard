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
import { resolveTimeframe, isWithin } from './timeframes.js';

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
    return {
      id: item.id,
      groupId: item.groupId,
      leadGen: map.leadGen ? parsers.parsePeople(c[map.leadGen], usersById) : [],
      salesRep: map.salesRep ? parsers.parsePeople(c[map.salesRep], usersById) : [],
      dates,
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

  // Collect everyone who appears in any metric.
  const personIds = new Set();
  for (const metric of BASE_METRICS) {
    for (const id of qty[metric].perPerson.keys()) personIds.add(id);
    for (const id of cohort[metric].perPerson.keys()) personIds.add(id);
  }

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
    if (!row.name) row.name = `User ${id}`;
    people.push(row);
  }
  people.sort((a, b) => b.sold - a.sold || b.sat - a.sat || b.assigned - a.assigned);

  const totals = {};
  for (const metric of BASE_METRICS) totals[metric] = qty[metric].total;
  totals.conv = {};
  for (const [label, [num, den]] of Object.entries(convDefs)) {
    totals.conv[label] = pct(cohort[num].total, cohort[den].total);
  }

  return { people, totals };
}

/**
 * Top-level: compute metrics for both roles for a timeframe.
 * @param {object} normalized board arrays keyed by board key
 * @param {string} timeframeId
 * @param {object} custom { from, to } for custom timeframe
 */
export function computeMetrics(normalized, timeframeId, custom = {}, now = new Date()) {
  const range = resolveTimeframe(timeframeId, custom, now);
  return {
    timeframe: timeframeId,
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    leadGen: computeRole(normalized, 'leadGen', range),
    salesRep: computeRole(normalized, 'salesRep', range),
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
