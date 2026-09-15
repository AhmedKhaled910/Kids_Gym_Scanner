import { google } from "googleapis";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Expected "Registrations" tab layout (row 1 = header, data from row 2):
 *
 * A: Child ID          (leave blank for new families — filled in automatically after sync)
 * B: Parent Name
 * C: Parent Phone
 * D: Child Name
 * E: Child Age
 * F: Entry Type         ("Parent" or "Nanny/Driver")
 * G: Allergies
 * H: Medical Info
 * I: Is Sick             (TRUE/FALSE)
 * J: Has Injury          (TRUE/FALSE)
 * K: Injury Notes
 * L: Emergency Contact Name
 * M: Emergency Contact Phone
 * N: WhatsApp Consent    (TRUE/FALSE)
 * O: Responsibility Consent Signed (TRUE/FALSE)
 *
 * Sync behaviour:
 * - Row with a blank Child ID  -> inserted as new, then the generated UUID
 *   is written back into column A.
 * - Row with a Child ID that matches an existing children_profiles row ->
 *   that row is UPDATED from the sheet's current values.
 * - Row with a Child ID that does NOT match anything in the database (e.g.
 *   a stray/duplicated value from dragging a cell down) -> self-heals by
 *   inserting a new row anyway and overwriting column A with the correct
 *   new ID, so it doesn't silently do nothing.
 */

const TAB_NAME = "Registrations";

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

function spreadsheetId() {
  return (
    process.env.GOOGLE_REGISTRATIONS_SPREADSHEET_ID ||
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  );
}

function toBool(v: string | undefined) {
  return String(v ?? "").trim().toUpperCase() === "TRUE";
}

export type SyncResult = {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  healed: number; // rows whose Child ID didn't match anything and got re-created
  errors: string[];
};

export async function syncRegistrations(): Promise<SyncResult> {
  const result: SyncResult = {
    ok: false,
    created: 0,
    updated: 0,
    skipped: 0,
    healed: 0,
    errors: [],
  };

  const sheets = getSheetsClient();
  const id = spreadsheetId();
  if (!sheets || !id) {
    result.errors.push(
      "Google Sheets is not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_SHEETS_SPREADSHEET_ID)."
    );
    return result;
  }

  const supabase = getSupabaseServerClient();

  let rows;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${TAB_NAME}!A2:O10000`,
    });
    rows = res.data.values ?? [];
  } catch (err: any) {
    result.errors.push(
      `Could not read the "${TAB_NAME}" tab. Make sure it exists and is shared with the service account. (${err?.message ?? err})`
    );
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sheetRowNumber = i + 2;
    const [
      childId,
      parentName,
      parentPhone,
      childName,
      childAge,
      entryType,
      allergies,
      medicalInfo,
      isSick,
      hasInjury,
      injuryNotes,
      emergencyName,
      emergencyPhone,
      whatsappConsent,
      responsibilityConsent,
    ] = row;

    if (!parentName && !childName) {
      result.skipped++;
      continue;
    }

    const record = {
      parent_name: parentName ?? "",
      parent_phone: parentPhone || null,
      child_name: childName ?? "",
      child_age: Number(childAge) || 0,
      entry_type: entryType === "Nanny/Driver" ? "Nanny/Driver" : "Parent",
      allergies: allergies || null,
      medical_info: medicalInfo || null,
      is_sick: toBool(isSick),
      has_injury: toBool(hasInjury),
      injury_notes: injuryNotes || null,
      emergency_contact_name: emergencyName || null,
      emergency_contact_phone: emergencyPhone || null,
      whatsapp_consent: toBool(whatsappConsent),
      responsibility_consent_signed: toBool(responsibilityConsent),
    };

    try {
      const trimmedId = childId ? childId.trim() : "";

      if (trimmedId) {
        // Try to update — but verify a row actually matched.
        const { data: updatedRows, error } = await supabase
          .from("children_profiles")
          .update(record)
          .eq("id", trimmedId)
          .select("id");

        if (error) throw error;

        if (updatedRows && updatedRows.length > 0) {
          result.updated++;
          continue;
        }

        // No row matched this ID — it's stale/invalid. Self-heal: insert
        // as new and overwrite column A with the correct ID.
        const { data: inserted, error: insertError } = await supabase
          .from("children_profiles")
          .insert(record)
          .select("id")
          .single();
        if (insertError || !inserted) throw insertError ?? new Error("Insert failed");

        await sheets.spreadsheets.values.update({
          spreadsheetId: id,
          range: `${TAB_NAME}!A${sheetRowNumber}`,
          valueInputOption: "RAW",
          requestBody: { values: [[inserted.id]] },
        });
        result.healed++;
      } else {
        // Blank Child ID — brand new family.
        const { data: inserted, error } = await supabase
          .from("children_profiles")
          .insert(record)
          .select("id")
          .single();
        if (error || !inserted) throw error ?? new Error("Insert failed");

        await sheets.spreadsheets.values.update({
          spreadsheetId: id,
          range: `${TAB_NAME}!A${sheetRowNumber}`,
          valueInputOption: "RAW",
          requestBody: { values: [[inserted.id]] },
        });
        result.created++;
      }
    } catch (err: any) {
      result.errors.push(`Row ${sheetRowNumber} (${childName || "unnamed"}): ${err?.message ?? err}`);
    }
  }

  result.ok = result.errors.length === 0;
  return result;
}
