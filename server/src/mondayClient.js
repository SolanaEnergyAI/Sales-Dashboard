/**
 * Thin Monday.com GraphQL (API v2) client.
 *
 * Responsible only for fetching raw board items + a users directory and
 * normalising the column values we care about (people ids + dates) into a
 * compact, board-agnostic shape. All metric logic lives in metrics.js.
 */
import { BOARD_COLUMN_IDS, runtime } from './config.js';

const API_URL = 'https://api.monday.com/v2';
const PAGE_SIZE = 500;

async function gql(query, variables = {}) {
  if (!runtime.mondayToken) {
    throw new Error('MONDAY_API_TOKEN is not set. Copy .env.example to .env and add your token.');
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: runtime.mondayToken,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Monday API HTTP ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Monday API error: ${JSON.stringify(json.errors).slice(0, 500)}`);
  }
  return json.data;
}

/** Parse a people column `value` JSON into an array of { id, name }. */
function parsePeople(columnValue, usersById) {
  if (!columnValue || !columnValue.value) return [];
  let parsed;
  try {
    parsed = JSON.parse(columnValue.value);
  } catch {
    return [];
  }
  const people = (parsed.personsAndTeams || []).filter((p) => p.kind !== 'team');
  return people.map((p) => ({
    id: String(p.id),
    name: usersById.get(String(p.id)) || `User ${p.id}`,
  }));
}

/** Parse a date column `value` JSON into a UTC Date (or null). */
function parseDate(columnValue) {
  if (!columnValue || !columnValue.value) return null;
  let parsed;
  try {
    parsed = JSON.parse(columnValue.value);
  } catch {
    return null;
  }
  if (!parsed || !parsed.date) return null;
  // Monday stores naive local dates; "YYYY-MM-DD" (+ optional "HH:mm:ss").
  // Interpret as UTC midnight when no time — good enough for day-bucketed metrics.
  const iso = parsed.time ? `${parsed.date}T${parsed.time}Z` : `${parsed.date}T00:00:00Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fetch the full users directory (id -> name) so we can label People columns. */
export async function fetchUsers() {
  const usersById = new Map();
  let page = 1;
  // Monday `users` is paginated via page/limit.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await gql(
      `query ($limit: Int!, $page: Int!) {
        users(limit: $limit, page: $page, kind: all) { id name }
      }`,
      { limit: 200, page },
    );
    const batch = data.users || [];
    for (const u of batch) usersById.set(String(u.id), u.name);
    if (batch.length < 200) break;
    page += 1;
  }
  return usersById;
}

/**
 * Fetch every item from a board, returning a normalised array of:
 *   { id, groupId, createdAt: Date, columns: { <columnId>: rawColumnValue } }
 * Only the columns configured for that board are requested.
 */
export async function fetchBoardItems(boardId) {
  const columnIds = BOARD_COLUMN_IDS[boardId] || [];
  const items = [];
  let cursor = null;
  let first = true;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let data;
    if (first) {
      data = await gql(
        `query ($boardId: [ID!], $limit: Int!, $columnIds: [String!]) {
          boards(ids: $boardId) {
            items_page(limit: $limit) {
              cursor
              items {
                id
                created_at
                group { id }
                column_values(ids: $columnIds) { id type text value }
              }
            }
          }
        }`,
        { boardId: [boardId], limit: PAGE_SIZE, columnIds },
      );
      const page = data.boards?.[0]?.items_page;
      pushItems(items, page?.items, columnIds);
      cursor = page?.cursor || null;
      first = false;
    } else {
      data = await gql(
        `query ($cursor: String!, $limit: Int!, $columnIds: [String!]) {
          next_items_page(cursor: $cursor, limit: $limit) {
            cursor
            items {
              id
              created_at
              group { id }
              column_values(ids: $columnIds) { id type text value }
            }
          }
        }`,
        { cursor, limit: PAGE_SIZE, columnIds },
      );
      const page = data.next_items_page;
      pushItems(items, page?.items, columnIds);
      cursor = page?.cursor || null;
    }
    if (!cursor) break;
  }

  return items;
}

function pushItems(target, rawItems, columnIds) {
  if (!rawItems) return;
  for (const raw of rawItems) {
    const columns = {};
    for (const cv of raw.column_values || []) columns[cv.id] = cv;
    target.push({
      id: raw.id,
      groupId: raw.group?.id || null,
      createdAt: raw.created_at ? new Date(raw.created_at) : null,
      columns,
    });
  }
}

export const parsers = { parsePeople, parseDate };
