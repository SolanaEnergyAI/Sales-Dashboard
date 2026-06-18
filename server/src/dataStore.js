/**
 * In-memory cache of normalised board data with background auto-refresh.
 * The dashboard reads metrics from this cache (fast) instead of hitting Monday
 * on every request. Refresh cadence is set by REFRESH_INTERVAL_SECONDS.
 */
import { BOARDS, runtime } from './config.js';
import { fetchBoardItems, fetchUsers } from './mondayClient.js';
import { normalizeBoard } from './metrics.js';

const state = {
  normalized: null, // { virtualCallCentre, salesFunnel, installations }
  usersById: new Map(),
  lastRefreshed: null,
  lastError: null,
  refreshing: false,
  counts: {},
};

let timer = null;

export async function refresh() {
  if (state.refreshing) return state;
  state.refreshing = true;
  try {
    const usersById = await fetchUsers();
    const [vcc, sf, iip] = await Promise.all([
      fetchBoardItems(BOARDS.virtualCallCentre),
      fetchBoardItems(BOARDS.salesFunnel),
      fetchBoardItems(BOARDS.installations),
    ]);

    state.normalized = {
      virtualCallCentre: normalizeBoard(BOARDS.virtualCallCentre, vcc, usersById),
      salesFunnel: normalizeBoard(BOARDS.salesFunnel, sf, usersById),
      installations: normalizeBoard(BOARDS.installations, iip, usersById),
    };
    state.counts = {
      virtualCallCentre: vcc.length,
      salesFunnel: sf.length,
      installations: iip.length,
    };
    state.usersById = usersById;
    state.lastRefreshed = new Date().toISOString();
    state.lastError = null;
    // eslint-disable-next-line no-console
    console.log(
      `[dataStore] refreshed: VCC=${vcc.length} SF=${sf.length} IIP=${iip.length} (${state.usersById.size} users)`,
    );
  } catch (err) {
    state.lastError = err.message;
    // eslint-disable-next-line no-console
    console.error('[dataStore] refresh failed:', err.message);
  } finally {
    state.refreshing = false;
  }
  return state;
}

export function startAutoRefresh() {
  if (timer) clearInterval(timer);
  refresh();
  timer = setInterval(refresh, runtime.refreshIntervalSeconds * 1000);
  return timer;
}

export function getState() {
  return state;
}

export function isReady() {
  return state.normalized !== null;
}
