import { google } from "googleapis";

let cachedSheets = null;
let cachedDrive = null;

export async function setupGoogleSheetsAPI() {
  if (cachedSheets && cachedDrive) {
    return { sheets: cachedSheets, drive: cachedDrive };
  }

  const credentials = JSON.parse(process.env.GOOGLE_SHEET_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });

  cachedSheets = google.sheets({ version: "v4", auth });
  cachedDrive = google.drive({ version: "v3", auth });

  return { sheets: cachedSheets, drive: cachedDrive };
}
