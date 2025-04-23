import { SlashCommandBuilder } from "discord.js";
import { setupGoogleSheetsAPI } from "../auth.js";
import { uploadImageToDrive } from "../utils/driveUploader.js";
import { createRecord } from "../utils/recordManager.js";

const messages = {
  success: {
    ja: (name, description, url, thumbnailDriveUrl, mainImageDriveUrl) =>
      `✅登録が完了しました！\n名前: ${name}\n説明: ${description}\nURL: ${url}\nサムネイル画像: ${thumbnailDriveUrl}\nメイン画像: ${mainImageDriveUrl}`,
    "en-US": (name, description, url, thumbnailDriveUrl, mainImageDriveUrl) =>
      `✅Registration completed!\nName: ${name}\nDescription: ${description}\nURL: ${url}\nThumbnail Image: ${thumbnailDriveUrl}\nMain Image: ${mainImageDriveUrl}`,
    ko: (name, description, url, thumbnailDriveUrl, mainImageDriveUrl) =>
      `✅등록이 완료되었습니다!\n이름: ${name}\n설명: ${description}\nURL: ${url}\n썸네일 이미지: ${thumbnailDriveUrl}\n메인 이미지: ${mainImageDriveUrl}`,
    "zh-TW": (name, description, url, thumbnailDriveUrl, mainImageDriveUrl) =>
      `✅註冊完成！\n名稱: ${name}\n描述: ${description}\nURL: ${url}\n縮圖圖片: ${thumbnailDriveUrl}\n主要圖片: ${mainImageDriveUrl}`, // 繁体字（台湾）
  },
  error: {
    duplication: {
      ja: (name) => `⚠️既に「${name}」という名前のデータが存在します。`,
      ko: (name) => `⚠️이미 '${name}'이라는 이름의 데이터가 존재합니다.`,
      "en-US": (name) => `⚠️Data with the name '${name}' already exists.`,
      "zh-TW": (name) => `⚠️已經存在名為 '${name}' 的資料。`, // 繁体字（台湾）
    },
    elseError: {
      ja: "⚠️登録中にエラーが発生しました。もう一度お試しください。",
      ko: "⚠️등록 중 오류가 발생했습니다. 다시 시도해 주세요.",
      "en-US": "⚠️An error occurred during registration. Please try again.",
      "zh-TW": "⚠️註冊過程中發生錯誤。請再試一次。",
    },
  },
};
export const data = new SlashCommandBuilder()
  .setName("register")
  .setDescription("情報をGoogleドライブとスプレッドシートに登録します")
  .setDescriptionLocalizations({
    "en-US": "Register images and info to Google Drive and Spreadsheet",
    ko: "Google Drive 및 스프레드시트에 이미지를 등록합니다",
    "zh-TW": "將資訊和圖片註冊到Google雲端硬碟和試算表", // 繁体字（台湾）
  })
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("名前")
      .setDescriptionLocalizations({
        ko: "이름",
        "en-US": "Name",
        "zh-TW": "名稱", // 繁体字（台湾）
      })
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("description")
      .setDescription("説明")
      .setDescriptionLocalizations({
        ko: "설명",
        "en-US": "Description",
        "zh-TW": "描述", // 繁体字（台湾）
      })
      .setRequired(true),
  )
  .addStringOption((option) =>
    option.setName("url").setDescription("URL").setRequired(true),
  )
  .addAttachmentOption((option) =>
    option
      .setName("thumbnail")
      .setDescription("サムネイル画像をアップロード")
      .setDescriptionLocalizations({
        ko: "썸네일 이미지를 업로드합니다",
        "en-US": "Uploading a thumbnail image",
        "zh-TW": "上傳縮圖圖片", // 繁体字（台湾）
      })
      .setRequired(true),
  )
  .addAttachmentOption((option) =>
    option
      .setName("main")
      .setDescription("メイン画像をアップロード")
      .setDescriptionLocalizations({
        ko: "메인 이미지를 업로드합니다",
        "en-US": "Uploading a main image",
        "zh-TW": "上傳主要圖片", // 繁体字（台湾）
      })
      .setRequired(true),
  );

export async function execute(interaction) {
  const supportedLangs = ["ja", "ko", "en-US", "zh-TW"];
  const lang = supportedLangs.includes(interaction.locale) ? interaction.locale : "ja";
  
  const name = interaction.options.getString("name");
  const description = interaction.options.getString("description");
  const thumbnailUrl = interaction.options.getAttachment("thumbnail").url;
  const mainImageUrl = interaction.options.getAttachment("main").url;
  let url = interaction.options.getString("url");
  if (url) {
    // URLをエンコード（既にエンコード済みの場合はそのまま）
    try {
      const decodedUrl = decodeURI(url); // 一度デコードしてみる
      url = encodeURI(decodedUrl); // 再エンコード
    } catch (e) {
      // デコードに失敗した場合は、そのままエンコード
      url = encodeURI(url);
    }
  }
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const globalName = interaction.user.globalName || username;
  const formattedName = `${globalName}@${username}`;

  const SPREADSHEET_ID = "1A4kmhZo9ZGlr4IZZiPSnUoo7p9FnSH9ujn0Bij7euY4";
  const folderId = "1XC1Ny2tsC6mA05dxM6dZ-cpv743E1vh8";

  try {
    // 最初に応答を保留
    await interaction.deferReply({ flags: 64 });

    const { sheets, drive } = await setupGoogleSheetsAPI();

    // シートから既存データを取得して重複をチェック
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "シート1!A:A", // 名前の列を取得
    });

    const existingNames = existingData.data.values?.flat() || [];

    if (existingNames.includes(name)) {
      await interaction.editReply({
        content: messages.error.duplication[lang](name),
        flags: 64,
      });
      return;
    }

    const thumbnailDriveUrl = await uploadImageToDrive(
      drive,
      thumbnailUrl,
      folderId,
      `${name}-thumb`,
    );
    const mainImageDriveUrl = await uploadImageToDrive(
      drive,
      mainImageUrl,
      folderId,
      `${name}-large`,
    );

    const rowData = [
      name,
      description,
      url,
      mainImageDriveUrl,
      thumbnailDriveUrl,
      userId,
      formattedName,
    ];

    await createRecord(sheets, rowData);

    const message =
      messages.success[lang]?.(
        name,
        description,
        url,
        thumbnailDriveUrl,
        mainImageDriveUrl,
      ) ||
      messages.success.ja(
        name,
        description,
        url,
        thumbnailDriveUrl,
        mainImageDriveUrl,
      );

    await interaction.editReply({
      content: message,
      flags: 64,
    });
  } catch (error) {
    console.error("エラー:", error);
    await interaction.editReply({
      content: messages.error.elseError[interaction.locale],
      flags: 64,
    });
  }
}
