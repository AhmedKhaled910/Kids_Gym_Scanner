import { google } from "googleapis";
import { CAFETERIA_ITEMS } from "@/lib/types";

/**
 * One row per check-in per day-tab. Check-in creates the row; check-out and
 * every add-on order (snack or extra hours) update that same row in place —
 * nothing appends a second row for the same visit.
 */

let cachedClient: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
  if (cachedClient) return cachedClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) return null;

  const privateKey = rawKey.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

function todayTabName() {
  return new Date().toISOString().slice(0, 10); // one tab per calendar day
}

// Column layout (A is index 0). Snack quantity columns come from
// CAFETERIA_ITEMS so adding an item there automatically adds a column here.
const FIXED_COLUMNS = [
  "Check-In ID", // A — helper key, safe to hide this column in Sheets
  "Parent Name", // B
  "Child Name", // C
  "Check-In Time", // D
  "Check-Out Time", // E
  "Duration Booked", // F
  "Entry Amount", // G
  "Entry Payment", // H
  "Extra Hours", // I — label of extra-hours add-on, if any
  "Extra Hours Amount", // J
];
const ITEM_COLUMNS = [...CAFETERIA_ITEMS]; // K, L, M, ... one per snack
const TAIL_COLUMNS = ["Cafeteria Total", "Staff"];
const HEADER_ROW = [...FIXED_COLUMNS, ...ITEM_COLUMNS, ...TAIL_COLUMNS];

const COL = {
  checkInId: 0,
  parentName: 1,
  childName: 2,
  checkInTime: 3,
  checkOutTime: 4,
  duration: 5,
  entryAmount: 6,
  entryPayment: 7,
  extraHoursLabel: 8,
  extraHoursAmount: 9,
  itemsStart: FIXED_COLUMNS.length, // first snack column index
  cafeteriaTotal: FIXED_COLUMNS.length + ITEM_COLUMNS.length,
  staff: FIXED_COLUMNS.length + ITEM_COLUMNS.length + 1,
};

function colLetter(index: number) {
  // 0 -> A, 25 -> Z, 26 -> AA ...
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

async function ensureTodayTabExists(spreadsheetId: string, tabName: string) {
  const sheets = getSheetsClient();
  if (!sheets) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === tabName);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADER_ROW] },
  });
}

/** Returns the 1-indexed sheet row number for a check-in ID, or null if not found. */
async function findRowNumber(
  spreadsheetId: string,
  tabName: string,
  checkInId: string
): Promise<number | null> {
  const sheets = getSheetsClient();
  if (!sheets) return null;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:A`,
  });
  const col = res.data.values ?? [];
  const idx = col.findIndex((row) => row[0] === checkInId);
  return idx === -1 ? null : idx + 1; // sheet rows are 1-indexed
}

async function readRow(spreadsheetId: string, tabName: string, rowNumber: number) {
  const sheets = getSheetsClient();
  if (!sheets) return null;
  const lastCol = colLetter(HEADER_ROW.length - 1);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A${rowNumber}:${lastCol}${rowNumber}`,
  });
  const row = res.data.values?.[0] ?? [];
  // pad to full width so index access is always safe
  while (row.length < HEADER_ROW.length) row.push("");
  return row;
}

async function writeRow(
  spreadsheetId: string,
  tabName: string,
  rowNumber: number,
  values: (string | number)[]
) {
  const sheets = getSheetsClient();
  if (!sheets) return;
  const lastCol = colLetter(HEADER_ROW.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A${rowNumber}:${lastCol}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

async function appendRow(spreadsheetId: string, tabName: string, values: (string | number)[]) {
  const sheets = getSheetsClient();
  if (!sheets) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

function config() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheets = getSheetsClient();
  if (!sheets || !spreadsheetId) {
    console.warn(
      "Google Sheets not configured — skipping. Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY to enable."
    );
    return null;
  }
  return { spreadsheetId, tabName: todayTabName() };
}

/** Creates the row for a new check-in. Call this right after inserting the check_ins record. */
export async function sheetCreateCheckInRow(input: {
  checkInId: string;
  parentName: string;
  childName: string;
  duration: string;
  entryAmount: number;
  entryPayment: string;
  staff: string;
}) {
  try {
    const cfg = config();
    if (!cfg) return;
    await ensureTodayTabExists(cfg.spreadsheetId, cfg.tabName);

    const row: (string | number)[] = new Array(HEADER_ROW.length).fill("");
    row[COL.checkInId] = input.checkInId;
    row[COL.parentName] = input.parentName;
    row[COL.childName] = input.childName;
    row[COL.checkInTime] = new Date().toLocaleString();
    row[COL.checkOutTime] = "";
    row[COL.duration] = input.duration;
    row[COL.entryAmount] = input.entryAmount;
    row[COL.entryPayment] = input.entryPayment;
    row[COL.extraHoursLabel] = "";
    row[COL.extraHoursAmount] = 0;
    for (let i = 0; i < ITEM_COLUMNS.length; i++) row[COL.itemsStart + i] = 0;
    row[COL.cafeteriaTotal] = 0;
    row[COL.staff] = input.staff;

    await appendRow(cfg.spreadsheetId, cfg.tabName, row);
  } catch (err) {
    console.error("Sheets sheetCreateCheckInRow failed:", err);
  }
}

/** Fills in the check-out time on the child's existing row. */
export async function sheetSetCheckOutTime(checkInId: string) {
  try {
    const cfg = config();
    if (!cfg) return;
    const rowNumber = await findRowNumber(cfg.spreadsheetId, cfg.tabName, checkInId);
    if (!rowNumber) return; // row may be on a previous day's tab — safe no-op
    const row = await readRow(cfg.spreadsheetId, cfg.tabName, rowNumber);
    if (!row) return;
    row[COL.checkOutTime] = new Date().toLocaleString();
    await writeRow(cfg.spreadsheetId, cfg.tabName, rowNumber, row);
  } catch (err) {
    console.error("Sheets sheetSetCheckOutTime failed:", err);
  }
}

/**
 * Records one add-on tap (a snack item, or an extra-hours option) on the
 * child's existing row: increments the matching item column by 1, or fills
 * the Extra Hours column, and updates the Cafeteria Total (snacks only).
 */
export async function sheetRecordAddon(input: {
  checkInId: string;
  item: string;
  price: number;
}) {
  try {
    const cfg = config();
    if (!cfg) return;
    const rowNumber = await findRowNumber(cfg.spreadsheetId, cfg.tabName, input.checkInId);
    if (!rowNumber) return;
    const row = await readRow(cfg.spreadsheetId, cfg.tabName, rowNumber);
    if (!row) return;

    const itemIndex = ITEM_COLUMNS.indexOf(input.item as any);
    if (itemIndex !== -1) {
      const col = COL.itemsStart + itemIndex;
      row[col] = Number(row[col] || 0) + 1;
      row[COL.cafeteriaTotal] = Number(row[COL.cafeteriaTotal] || 0) + input.price;
    } else {
      // treat as an extra-hours add-on
      const existingLabel = String(row[COL.extraHoursLabel] || "");
      row[COL.extraHoursLabel] = existingLabel ? `${existingLabel}, ${input.item}` : input.item;
      row[COL.extraHoursAmount] = Number(row[COL.extraHoursAmount] || 0) + input.price;
    }

    await writeRow(cfg.spreadsheetId, cfg.tabName, rowNumber, row);
  } catch (err) {
    console.error("Sheets sheetRecordAddon failed:", err);
  }
}
