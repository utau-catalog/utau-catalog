import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { setupGoogleSheetsAPI } from "../auth.js";

const errorMessages = {
  noData: {
    ja: "⚠️スプレッドシートにデータがありません。",
    ko: "⚠️스프레드시트에 데이터가 없습니다.",
    "en-US": "⚠️No data found in the spreadsheet.",
    "zh-TW": "⚠️試算表中找不到資料。",
  },
  fetchError: {
    ja: "⚠️データ取得中にエラーが発生しました。",
    ko: "⚠️데이터를 가져오는 중 오류가 발생했습니다.",
    "en-US": "⚠️An error occurred while fetching data.",
    "zh-TW": "⚠️獲取資料時發生錯誤。",
  },
};

export const data = new SlashCommandBuilder()
  .setName("random")
  .setDescription("Googleスプレッドシートの情報をランダムに取得")
  .setDescriptionLocalizations({
    ko: "Google 스프레드시트의 정보를 무작위로 가져옵니다",
    "en-US": "Retrieving information randomly from Google Sheets",
    "zh-TW": "從Google試算表隨機獲取資訊",
  });

export async function execute(interaction) {
  const supportedLangs = ["ja", "ko", "en-US", "zh-TW"];
  const lang = supportedLangs.includes(interaction.locale) ? interaction.locale : "ja";

  try {
    // 最初に応答を保留
    await interaction.deferReply();

    const { sheets } = await setupGoogleSheetsAPI();

    const SPREADSHEET_ID = "1A4kmhZo9ZGlr4IZZiPSnUoo7p9FnSH9ujn0Bij7euY4";
    const RANGE = "シート1!A:E";

    // Googleスプレッドシートからデータを取得
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });

    const rows = result?.data?.values;

    if (!rows || rows.length === 0) {
      return await interaction.editReply({
        content: errorMessages.noData[lang] || errorMessages.noData.ja,
      });
    }

    // ヘッダーを除外してデータをシャッフル 2024.12.16追加
    const dataRows = rows.slice(1);
    for (let i = dataRows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dataRows[i], dataRows[j]] = [dataRows[j], dataRows[i]];
    }
    const row = dataRows[0]; // シャッフル後の先頭行を選択

    function convertGoogleDriveLink(driveLink) {
      const fileIdMatch = driveLink.match(/\/file\/d\/([-_\w]+)\//);
      return fileIdMatch
        ? `https://drive.google.com/uc?id=${fileIdMatch[1]}`
        : driveLink;
    }

    const mainImageUrl = row[3] ? convertGoogleDriveLink(row[3]) : null;
    const thumbnailUrl = row[4] ? convertGoogleDriveLink(row[4]) : null;

    // 埋め込みメッセージを作成
    const embed = new EmbedBuilder()
      .setTitle(row[0]) // 名前
      .setDescription(row[1]) // 説明
      .setColor("#54e8e6");

    if (mainImageUrl) embed.setImage(mainImageUrl);
    if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
    if (row[2]) {
      embed.addFields([{ name: "配布所URL", value: row[2], inline: false }]);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("エラー:", error);

    const fallbackMessage = errorMessages.fetchError[lang] || errorMessages.fetchError.ja;

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: fallbackMessage, ephemeral: true });
      } else {
        await interaction.editReply({ content: fallbackMessage });
      }
    } catch (editError) {
      console.error("エラーメッセージ送信失敗:", editError);
    }
  }
}
