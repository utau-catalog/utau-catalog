export async function createRecord(sheetsService, data) {
  const SPREADSHEET_ID = "1A4kmhZo9ZGlr4IZZiPSnUoo7p9FnSH9ujn0Bij7euY4";
  const RANGE = "シート1!A:K";

  const request = {
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    resource: {
      values: [
        [
          data[0], // name
          data[1], // description
          data[2], // url
          data[3], // mainImageDriveUrl
          data[4], // thumbnailDriveUrl
          data[5], // userId
          data[6], // formattedName
          "", // H列（空）
          "", // I列（空）
          "", // J列（空）
          "=ROW()-1", // K列
        ],
      ],
    },
  };

  try {
    const response = await sheetsService.spreadsheets.values.append(request);
    return response.data; // 成功した場合はレスポンスデータを返す
  } catch (error) {
    console.error("Sheets API Error:", error);
    throw new Error(
      "Failed to create record in Google Sheets: " + error.message,
    );
  }
}
