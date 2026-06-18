import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsers } from '../src/mondayClient.js';
import { normalizeBoard, computeMetrics } from '../src/metrics.js';
import { BOARDS } from '../src/config.js';

/**
 * Regression tests built from REAL Monday GraphQL payloads pulled from the
 * Installations In Progress board, to guarantee the parser keeps handling the
 * exact value shapes the live API returns.
 */

const users = new Map([
  ['100092316', 'Andrew Wagner'],
  ['96522094', 'Warren Thorogood'],
  ['99991377', 'Carraigh Murphy'],
  ['96453154', 'Bradley Davey'],
  ['59676294', 'Heads Up'],
]);

// Mirrors mondayClient.pushItems(): GraphQL item -> normalizer input shape.
function toInput(raw) {
  const columns = {};
  for (const cv of raw.column_values) columns[cv.id] = cv;
  return {
    id: raw.id,
    groupId: raw.group?.id || null,
    createdAt: raw.created_at ? new Date(raw.created_at) : null,
    columns,
  };
}

// Real items (subset) copied verbatim from the live API.
const RAW = [
  {
    id: '11673097064', created_at: '2026-04-04T07:37:35Z', group: { id: 'new_group61847__1' },
    column_values: [
      { id: 'date5', type: 'date', text: '2026-04-17 17:30', value: '{"date":"2026-04-17","time":"07:30:00"}' },
      { id: 'people5', type: 'people', text: 'Andrew Wagner', value: '{"personsAndTeams":[{"id":100092316,"kind":"person"}]}' },
      { id: 'people4', type: 'people', text: 'Bradley Davey', value: '{"personsAndTeams":[{"id":96453154,"kind":"person"}]}' },
      { id: 'creation_log', type: 'creation_log', text: '2026-04-04 07:37:35 UTC', value: '{"created_at":"2026-04-04T07:37:35Z","creator_id":"59676294"}' },
      { id: 'date9', type: 'date', text: '2026-05-01', value: '{"date":"2026-05-01","changed_at":"2026-04-30T23:45:28.901Z"}' },
      { id: 'date3', type: 'date', text: '2026-04-07', value: '{"date":"2026-04-07"}' },
      { id: 'date__1', type: 'date', text: '2026-04-04', value: '{"date":"2026-04-04"}' },
    ],
  },
  {
    id: '12295150107', created_at: '2026-06-16T20:29:49Z', group: { id: 'new_group61847__1' },
    column_values: [
      { id: 'date5', type: 'date', text: '2026-06-17', value: '{"date":"2026-06-17"}' },
      { id: 'people5', type: 'people', text: 'Warren Thorogood', value: '{"personsAndTeams":[{"id":96522094,"kind":"person"}]}' },
      { id: 'people4', type: 'people', text: 'Warren Thorogood', value: '{"personsAndTeams":[{"id":96522094,"kind":"person"}]}' },
      { id: 'creation_log', type: 'creation_log', text: '2026-06-16 20:29:49 UTC', value: '{"created_at":"2026-06-16T20:29:49Z","creator_id":"96522094"}' },
      { id: 'date9', type: 'date', text: '2026-06-16', value: '{"date":"2026-06-16","time":null,"changed_at":"2026-06-16T20:42:02.093Z"}' },
      { id: 'date3', type: 'date', text: '2026-06-17', value: '{"date":"2026-06-17"}' },
      { id: 'date__1', type: 'date', text: '2026-06-16', value: '{"date":"2026-06-16","changed_at":"2026-06-18T08:24:42.294Z"}' },
    ],
  },
  {
    // Subcontracting job: no people, no Sold Date -> must be excluded from Sat/Sold.
    id: '10796438858', created_at: '2025-12-17T09:52:46Z', group: { id: 'new_group56206' },
    column_values: [
      { id: 'date5', type: 'date', text: '', value: null },
      { id: 'people5', type: 'people', text: '', value: null },
      { id: 'people4', type: 'people', text: '', value: null },
      { id: 'creation_log', type: 'creation_log', text: '2025-12-17 09:52:46 UTC', value: '{"created_at":"2025-12-17T09:52:46Z","creator_id":"32649470"}' },
      { id: 'date9', type: 'date', text: '', value: null },
      { id: 'date3', type: 'date', text: '', value: null },
      { id: 'date__1', type: 'date', text: '', value: null },
    ],
  },
  {
    id: '11866117588', created_at: '2026-04-28T10:37:16Z', group: { id: 'group_mm47c3nx' },
    column_values: [
      { id: 'date5', type: 'date', text: '2026-05-12 14:00', value: '{"date":"2026-05-12","time":"04:00:00"}' },
      { id: 'people5', type: 'people', text: 'Warren Thorogood', value: '{"personsAndTeams":[{"id":96522094,"kind":"person"}]}' },
      { id: 'people4', type: 'people', text: 'Carraigh Murphy', value: '{"personsAndTeams":[{"id":99991377,"kind":"person"}]}' },
      { id: 'creation_log', type: 'creation_log', text: '2026-04-28 10:37:16 UTC', value: '{"created_at":"2026-04-28T10:37:16Z","creator_id":"39969841"}' },
      { id: 'date9', type: 'date', text: '2026-06-04', value: '{"date":"2026-06-04","changed_at":"2026-06-03T22:11:39.499Z"}' },
      { id: 'date3', type: 'date', text: '2026-04-29', value: '{"date":"2026-04-29"}' },
      { id: 'date__1', type: 'date', text: '2026-04-28', value: '{"date":"2026-04-28"}' },
    ],
  },
  {
    // People value with `changed_at` BEFORE `personsAndTeams` (key order varies).
    id: '12226164217', created_at: '2026-06-09T00:00:44Z', group: { id: 'group_mm41ev0h' },
    column_values: [
      { id: 'date5', type: 'date', text: '2026-06-09', value: '{"date":"2026-06-09"}' },
      { id: 'people5', type: 'people', text: 'Andrew Wagner', value: '{"personsAndTeams":[{"id":100092316,"kind":"person"}]}' },
      { id: 'people4', type: 'people', text: 'Heads Up', value: '{"changed_at":"2026-06-18T08:17:54.865Z","personsAndTeams":[{"id":59676294,"kind":"person"}]}' },
      { id: 'creation_log', type: 'creation_log', text: '2026-06-09 00:00:44 UTC', value: '{"created_at":"2026-06-09T00:00:44Z","creator_id":"100092316"}' },
      { id: 'date9', type: 'date', text: '2026-06-09', value: '{"date":"2026-06-09","time":null,"changed_at":"2026-06-09T00:23:00.905Z"}' },
      { id: 'date3', type: 'date', text: '2026-06-09', value: '{"date":"2026-06-09"}' },
      { id: 'date__1', type: 'date', text: '2026-06-09', value: '{"date":"2026-06-09","changed_at":"2026-06-18T08:54:19.097Z"}' },
    ],
  },
];

test('parseNumber handles formula display_value and plain numbers', () => {
  assert.equal(parsers.parseNumber({ type: 'formula', display_value: '$12,345.67' }), 12345.67);
  assert.equal(parsers.parseNumber({ type: 'numeric', value: '8000', text: '8000' }), 8000);
  assert.equal(parsers.parseNumber({ type: 'formula', display_value: '' }), null);
  assert.equal(parsers.parseNumber(null), null);
  assert.equal(parsers.parseNumber({ type: 'numeric', value: null, text: '' }), null);
});

test('parsers handle the real Monday value shapes', () => {
  const cols = (id) => RAW.find((r) => r.id === id).column_values.reduce((m, c) => ((m[c.id] = c), m), {});

  // People: id extracted regardless of key order; empty -> [].
  assert.deepEqual(parsers.parsePeople(cols('11673097064').people5, users), [{ id: '100092316', name: 'Andrew Wagner' }]);
  assert.deepEqual(parsers.parsePeople(cols('12226164217').people4, users), [{ id: '59676294', name: 'Heads Up' }]);
  assert.deepEqual(parsers.parsePeople(cols('10796438858').people5, users), []);

  // Dates: time present, time null, date only, and empty.
  assert.equal(parsers.parseDate(cols('11673097064').date5).toISOString(), '2026-04-17T07:30:00.000Z');
  assert.equal(parsers.parseDate(cols('12295150107').date9).toISOString(), '2026-06-16T00:00:00.000Z'); // time:null
  assert.equal(parsers.parseDate(cols('11673097064').date9).toISOString(), '2026-05-01T00:00:00.000Z');
  assert.equal(parsers.parseDate(cols('10796438858').date9), null);
});

test('engine computes correct totals on the real installations sample', () => {
  const normalized = {
    virtualCallCentre: [],
    salesFunnel: [],
    installations: normalizeBoard(BOARDS.installations, RAW.map(toInput), users),
  };
  const r = computeMetrics(normalized, 'all_time');

  // 4 items have a Sold Date (one is subcontracting w/ none) -> Sold total 4.
  assert.equal(r.salesRep.totals.sold, 4);
  assert.equal(r.leadGen.totals.sold, 4);

  // Sales Rep Sold by person: Andrew 2 (items 1 & 5), Warren 2 (items 2 & 4).
  const andrew = r.salesRep.people.find((p) => p.id === '100092316');
  const warren = r.salesRep.people.find((p) => p.id === '96522094');
  assert.equal(andrew.sold, 2);
  assert.equal(warren.sold, 2);

  // Sat == Sold here (all sold items have an appointment date); subcontracting excluded.
  assert.equal(r.salesRep.totals.sat, 4);

  // Lead Gen Sold attribution incl. the changed_at-first people value (Heads Up).
  const headsUp = r.leadGen.people.find((p) => p.id === '59676294');
  assert.equal(headsUp.sold, 1);
});
