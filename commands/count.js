import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { setupGoogleSheetsAPI } from "../auth.js";

const embedTitles = {
  ja: "現在の登録数",
  ko: "현재 등록 수",
  "en-US": "Current Number of Registrations",
  "zh-TW": "目前註冊數量", // 繁体字（台湾）
};

const embedDescriptions = {
  ja: (count) => `現在登録されているデータは **${count}** 件です。`,
  ko: (count) => `현재 등록된 데이터는 **${count}** 개입니다.`,
  "en-US": (count) => `The current number of registered data is **${count}**.`,
  "zh-TW": (count) => `目前註冊的數據共有 **${count}** 筆。`, // 繁体字（台湾）
};

const errorMessages = {
  noData: {
    ja: "⚠️スプレッドシートにデータがありません。",
    ko: "⚠️스프레드시트에 데이터가 없습니다.",
    "en-US": "⚠️No data found in the spreadsheet.",
    "zh-TW": "⚠️試算表中找不到資料。", // 繁体字（台湾）
  },
  fetchError: {
    ja: "⚠️データ取得中にエラーが発生しました。",
    ko: "⚠️데이터를 가져오는 중 오류가 발생했습니다.",
    "en-US": "⚠️An error occurred while fetching data.",
    "zh-TW": "⚠️獲取資料時發生錯誤。", // 繁体字（台湾）
  },
};

export const data = new SlashCommandBuilder()
  .setName("count")
  .setDescription("現在の登録数を返します")
  .setDescriptionLocalizations({
    ko: "현재 등록 수를 반환합니다",
    "en-US": "Returns the current number of registrations",
    "zh-TW": "返回目前的註冊數量", // 繁体字（台湾）
  });

export async function execute(interaction) {
  try {
    const lang = interaction.locale || "ja";

    await interaction.deferReply({ flags: 0 });

    const { sheets } = await setupGoogleSheetsAPI();

    const SPREADSHEET_ID = "1A4kmhZo9ZGlr4IZZiPSnUoo7p9FnSH9ujn0Bij7euY4";
    const RANGE = "シート1!A:E";

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });

    // チェック用
    // console.log("sheets API ready:", !!sheets);
    // console.log("Google Sheets API result:", JSON.stringify(result, null, 2));
    // チェック用

    const rows = result.data.values;

    if (!rows || rows.length === 0) {
      const errorMessage =
        errorMessages.noData[lang] || errorMessages.noData.ja;
      await interaction.editReply(errorMessage);
      return;
    }

    const numberOfRegistrations = rows.length - 1;

    const embed = new EmbedBuilder()
      .setTitle(embedTitles[lang] || embedTitles.ja)
      .setDescription(
        embedDescriptions[lang](numberOfRegistrations) ||
          embedDescriptions.ja(numberOfRegistrations),
      )
      .setColor("#54e8e6");

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("エラー:", error);
    const lang = ["ja", "ko", "en", "zh-TW"].includes(
      interaction.locale.split("-")[0],
    )
      ? interaction.locale.split("-")[0]
      : "ja";
    await interaction.editReply(errorMessages.fetchError[lang]);
  }
}
