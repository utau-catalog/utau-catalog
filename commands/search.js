import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { setupGoogleSheetsAPI } from "../auth.js";

const errorMessages = {
  noData: {
    ja: "⚠️スプレッドシートにデータがありません。",
    ko: "⚠️스프레드시트에 데이터가 없습니다.",
    "en-US": "⚠️No data found in the spreadsheet.",
    "zh-TW": "⚠️試算表中找不到資料。",
  },
  notFound: {
    ja: (name) =>
      `「⚠️${name}」という名前のキャラクターは見つかりませんでした。`,
    ko: (name) => `'⚠️${name}'이라는 이름의 캐릭터를 찾을 수 없습니다.`,
    "en-US": (name) => `⚠️No character found with the name '${name}'.`,
    "zh-TW": (name) => `⚠️No character found with the name '${name}`,
  },
  fetchError: {
    ja: "⚠️データ取得中にエラーが発生しました。",
    ko: "⚠️데이터를 가져오는 중 오류가 발생했습니다.",
    "en-US": "⚠️An error occurred while fetching data.",
    "zh-TW": "⚠️獲取資料時發生錯誤。",
  },
};

export const data = new SlashCommandBuilder()
  .setName("search")
  .setDescription("名前が一致するキャラクター情報を表示する")
  .setDescriptionLocalizations({
    ko: "이름이 일치하는 캐릭터 정보를 표시합니다",
    "en-US": "Displaying character information that matches the name",
    "zh-TW": "顯示名稱相符的角色資訊",
  })
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("キャラクターの名前を入力してください")
      .setDescriptionLocalizations({
        ko: "캐릭터의 이름을 입력하세요",
        "en-US": "Please enter the character's name",
        "zh-TW": "請輸入角色的名稱",
      })
      .setRequired(true),
  );

export async function execute(interaction) {
  const lang = interaction.locale || "ja";
  const name = interaction.options.getString("name");

  try {
    // 最初に応答を保留
    await interaction.deferReply({ flags: 0 });

    const { sheets } = await setupGoogleSheetsAPI();

    const SPREADSHEET_ID = "1A4kmhZo9ZGlr4IZZiPSnUoo7p9FnSH9ujn0Bij7euY4";
    const RANGE = "シート1!A:E"; // 名前、説明、URL、サムネイル、大きな画像の列を含む範囲

    // Googleスプレッドシートからデータを取得
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });

    const rows = result?.data?.values;

    if (!rows || rows.length === 0) {
      const errorMessage = errorMessages.noData[lang];
      await interaction.editReply(errorMessage);
      return;
    }

    // 入力された名前を検索
    const matchedRow = rows.find((row) => row[0] === name); // 名前が列Aにある場合

    if (!matchedRow) {
      const errorMessage = errorMessages.notFound[lang](name);
      await interaction.editReply(errorMessage);
      return;
    }

    function convertGoogleDriveLink(driveLink) {
      const fileIdMatch = driveLink.match(/\/file\/d\/([-_\w]+)\//);
      return fileIdMatch
        ? `https://drive.google.com/uc?id=${fileIdMatch[1]}`
        : driveLink;
    }

    const mainImageUrl = matchedRow[3]
      ? convertGoogleDriveLink(matchedRow[3])
      : null;
    const thumbnailUrl = matchedRow[4]
      ? convertGoogleDriveLink(matchedRow[4])
      : null;

    // 埋め込みメッセージを作成
    const embed = new EmbedBuilder()
      .setTitle(matchedRow[0]) // 名前
      .setDescription(matchedRow[1]) // 説明
      .setColor("#54e8e6");

    if (mainImageUrl) embed.setImage(mainImageUrl);
    if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
    if (matchedRow[2]) {
      embed.addFields([
        { name: "配布所URL", value: matchedRow[2], inline: false },
      ]);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("エラー:", error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "⚠️エラーが発生しました。",
        flags: 64,
      });
    } else {
      await interaction.editReply({
        content: `${errorMessages.fetchError[lang]}`,
        flags: 64,
      });
    }
  }
}
