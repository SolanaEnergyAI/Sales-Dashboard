/**
 * Single source of truth for the Solana Energy Monday.com CRM mapping.
 *
 * Every ID in this file was read directly from the live boards. If a column is
 * renamed in Monday the *ID* stays the same, so this mapping keeps working; only
 * if a column is deleted/recreated would these need updating.
 *
 * Workflow recap (from the CRM Lead-to-Sale manual):
 *   Virtual Call Centre  ->  Sales Funnel  ->  Installations In Progress
 *   (lead assigned)          (booked/sat)      (sold deal handed to ops)
 */

export const BOARDS = {
  virtualCallCentre: '7387546685',
  salesFunnel: '3012085157',
  installations: '4625121791',
};

/**
 * Per-board column IDs we read. `lead_gen` / `sales_rep` are People columns,
 * the rest are date columns (plus the creation_log used for conversion cohorts).
 */
export const COLUMNS = {
  // 📞 Virtual Call Centre
  virtualCallCentre: {
    leadGen: 'person', // "Lead Gen" people column
    salesRep: 'people7__1', // "*️⃣ Sales Rep"
    assignedToLg: 'date0__1', // "Assigned to LG"
    appointmentDate: 'date2', // "*️⃣ Appointment Date & Time"
    creationLog: 'creation_log',
    leadSource: 'lead_source', // "*️⃣ Lead Source"
    cpl: 'numbers__1', // "CPL"
  },
  // 🤝 Sales Funnel
  salesFunnel: {
    salesRep: 'person', // "*️⃣ Sales Rep"
    leadGen: 'people8', // "*️⃣ Lead Gen"
    appointmentDate: 'date5', // "*️⃣ Appointment Date"
    bookedDate: 'date1', // "Booked Date"
    assignedToLg: 'date__1', // "Assigned to LG"
    creationLog: 'pulse_log_mkt5pwbr', // "Creation log"
    leadSource: 'lead_source_1', // "*️⃣ Lead Source"
    cpl: 'numbers__1', // "CPL"
  },
  // 🔄️ Installations In Progress
  installations: {
    salesRep: 'people5', // "✅ Sales Rep"
    leadGen: 'people4', // "✅ Lead Gen"
    soldDate: 'date9', // "✅ Sold Date"  (filled === Solana sale)
    bookedDate: 'date3', // "✅ Booked Date"
    appointmentDate: 'date5', // "✅ Appointment Date"
    assignedToLg: 'date__1', // "✅ Assigned to LG"
    creationLog: 'creation_log',
    leadSource: 'lead_source_1', // "✅ Lead Source"
    cpl: 'numbers__1', // "✅ CPL"
    // Revenue at point of sale = Total Cash Price (reliably populated when sold).
    revenue: 'formula98', // "🤝 Total Cash Price ✅" (formula)
    // Gross Profit + the "Total Revenue" formula only populate post-install
    // (job-costing). Kept here for when those figures are filled in.
    grossProfit: 'formula_mks93vrv', // "💵 Gross Profit ✅" (formula)
    realizedRevenue: 'formula_mks9q4r9', // "💵 Total Revenue ✅" (post-install)
  },
};

/**
 * The Sales Funnel groups that count as a *sat* appointment ("Post Sat" stages).
 * Per the manual: to track Sat appointments, add all the "Post Sat" groups.
 */
export const SALES_FUNNEL_POST_SAT_GROUPS = [
  'group_mm3zhb33', // Post Sat >>> Proposal Pending
  'new_group41259', // Post Sat >>> Proposal Sent
  'new_group35090', // Post Sat >>> Sale Pending
  'new_group69484', // Post Sat >>> Sat Not Sold
];

/**
 * Which columns to request from each board (keeps API payloads small).
 */
export const BOARD_COLUMN_IDS = {
  [BOARDS.virtualCallCentre]: Object.values(COLUMNS.virtualCallCentre),
  [BOARDS.salesFunnel]: Object.values(COLUMNS.salesFunnel),
  [BOARDS.installations]: Object.values(COLUMNS.installations),
};

export const runtime = {
  port: Number(process.env.PORT) || 4000,
  refreshIntervalSeconds: Number(process.env.REFRESH_INTERVAL_SECONDS) || 300,
  timezone: process.env.DASHBOARD_TIMEZONE || 'Australia/Sydney',
  mondayToken: process.env.MONDAY_API_TOKEN || '',
};
