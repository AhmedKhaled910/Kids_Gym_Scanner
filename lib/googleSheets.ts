import { google } from "googleapis";

/**
 * Appends one row to today's tab in the configured Google Sheet, creating
 * that tab first if it doesn't exist yet. Used to keep a daily log of
 * check-ins, check-outs, and cafeteria orders outside of Supabase.
 *
 * Silently no-ops (logs a warning) if the Google env vars aren't set, so
 * the app keeps working even before Sheets is configured.
 */

let cachedClient: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
  if (cachedClient) return cachedClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) return null;

  // Vercel env vars store literal "\n" — convert back to real newlines.
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
  // e.g. "2026-08-06" — one tab per calendar day
  return new Date().toISOString().slice(0, 10);
}

const HEADER_ROW = [
  "Timestamp",
  "Event",
  "Parent Name",
  "Child Name",
  "Details",
  "Amount",
  "Staff",
];

async function ensureTodayTabExists(spreadsheetId: string, tabName: string) {
  const sheets = getSheetsClient();
  if (!sheets) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some(
    (s) => s.properties?.title === tabName
  );
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabName } } }],
    },
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADER_ROW] },
  });
}

export async function appendDailyLogRow(row: {
  event: string;
  parentName: string;
  childName: string;
  details: string;
  amount: number | string;
  staff: string;
}) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheets = getSheetsClient();
    if (!sheets || !spreadsheetId) {
      console.warn(
        "Google Sheets not configured — skipping log row. Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY to enable."
      );
      return;
    }

    const tabName = todayTabName();
    await ensureTodayTabExists(spreadsheetId, tabName);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            new Date().toLocaleString(),
            row.event,
            row.parentName,
            row.childName,
            row.details,
            String(row.amount),
            row.staff,
          ],
        ],
      },
    });
  } catch (err) {
    // Never let a Sheets failure break check-in/check-out for staff.
    console.error("Google Sheets append failed:", err);
  }
}
