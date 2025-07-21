import { SlashCommandBuilder } from "discord.js";
import { setupGoogleSheetsAPI } from "../auth.js";
import { uploadImageToDrive } from "../utils/driveUploader.js";

// URLからファイルIDを抽出
function extractFileIdFromUrl(url) {
  const regex = /[-\w]{25,}/;
  const match = url.match(regex);
  return match ? match[0] : null;
}

// Google Driveの画像を削除
async function deleteImageFromDrive(driveService, imageUrl) {
  try {
    const fileId = extractFileIdFromUrl(imageUrl);
    if (!fileId) return console.log("無効な画像URL:", imageUrl);

    await driveService.files.delete({ fileId });
    console.log(`画像削除成功: ファイルID ${fileId}`);
  } catch (error) {
    console.error("画像削除中のエラー:", error);
  }
}

// 画像アップロード関数をtry-catchで安全に呼び出す
async function safeUploadImageToDrive(drive, imageUrl, folderId, fileName) {
  try {
    return await uploadImageToDrive(drive, imageUrl, folderId, fileName);
  } catch (error) {
    console.error(`画像アップロード失敗 (${fileName}):`, error);
    return null; // 失敗時はnullを返す
  }
}

const messages = {
  success: {
    ja: "✅キャラクター情報を更新しました。",
    ko: "✅캐릭터 정보를 업데이트했습니다.",
    "en-US": "✅Character information has been updated.",
    "zh-TW": "✅角色資訊已更新。",
  },
  error: {
    noData: {
      ja: "⚠️指定したキャラクターが見つかりませんでした。",
      ko: "⚠️지정한 캐릭터를 찾을 수 없습니다.",
      "en-US": "⚠️The specified character could not be found.",
      "zh-TW": "⚠️找不到指定的角色。",
    },
    fetchError: {
      ja: "⚠️情報の更新中にエラーが発生しました。",
      ko: "⚠️정보를 업데이트하는 중 오류가 발생했습니다.",
      "en-US": "⚠️An error occurred while updating the information.",
      "zh-TW": "⚠️更新資訊時發生錯誤。",
    },
  },
};

export const data = new SlashCommandBuilder()
  .setName("edit")
  .setDescription("キャラクター情報を編集する")
  .setDescriptionLocalizations({
    ko: "캐릭터 정보를 수정합니다",
    "en-US": "Editing character information",
    "zh-TW": "編輯角色資訊",
  })
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("編集するキャラクターの名前")
      .setDescriptionLocalizations({
        ko: "수정할 캐릭터의 이름",
        "en-US": "Name of the character to edit",
        "zh-TW": "要編輯的角色名稱",
      })
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("description")
      .setDescription("新しい説明")
      .setDescriptionLocalizations({
        ko: "새로운 설명",
        "en-US": "New description",
        "zh-TW": "新的描述",
      })
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName("url")
      .setDescription("新しいURL")
      .setDescriptionLocalizations({
        ko: "새로운 URL",
        "en-US": "New URL",
        "zh-TW": "新的URL",
      })
      .setRequired(false),
  )
  .addAttachmentOption((option) =>
    option
      .setName("thumbnail")
      .setDescription("新しいサムネイル画像をアップロード")
      .setDescriptionLocalizations({
        ko: "새로운 썸네일 이미지를 업로드합니다",
        "en-US": "Uploading a new thumbnail image",
        "zh-TW": "上傳新的縮圖圖片",
      })
      .setRequired(false),
  )
  .addAttachmentOption((option) =>
    option
      .setName("main")
      .setDescription("新しいメイン画像をアップロード")
      .setDescriptionLocalizations({
        ko: "새로운 메인 이미지를 업로드합니다",
        "en-US": "Uploading a new main image",
        "zh-TW": "上傳新的主要圖片",
      })
      .setRequired(false),
  );

export async function execute(interaction) {
  const supportedLangs = ["ja", "ko", "en-US", "zh-TW"];
  const lang = supportedLangs.includes(interaction.locale) ? interaction.locale : "ja";
  
  const name = interaction.options.getString("name");
  const newDescription = interaction.options.getString("description");
  const newThumbnailUrl = interaction.options.getAttachment("thumbnail")
    ? interaction.options.getAttachment("thumbnail").url
    : null;
  const newMainImageUrl = interaction.options.getAttachment("main")
    ? interaction.options.getAttachment("main").url
    : null;
  let newUrl = interaction.options.getString("url");
  if (newUrl) {
    // URLをエンコード（既にエンコード済みの場合はそのまま）
    try {
      const decodedUrl = decodeURI(newUrl); // 一度デコードしてみる
      newUrl = encodeURI(decodedUrl); // 再エンコード
    } catch (e) {
      // デコードに失敗した場合は、そのままエンコード
      newUrl = encodeURI(newUrl);
    }
  }
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const globalName = interaction.user.globalName || username;
  const formattedName = `${globalName}@${username}`;

  // デバッグ用ログ
  console.log("Attachment options:", {
    thumbnail: newThumbnailUrl,
    main: newMainImageUrl,
  });

  try {
    // 最初に応答を保留
    await interaction.deferReply({ flags: 64 });

    const { sheets, drive } = await setupGoogleSheetsAPI();

    const SPREADSHEET_ID = "1A4kmhZo9ZGlr4IZZiPSnUoo7p9FnSH9ujn0Bij7euY4";
    const RANGE = "シート1!A:I";
    const folderId = "1XC1Ny2tsC6mA05dxM6dZ-cpv743E1vh8";

    // スプレッドシートからデータを取得
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });

    const rows = data.values;
    let rowIndex = -1;

    // キャラクター名を検索
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === name) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      await interaction.editReply({
        content: messages.error.noData[lang],
        flags: 64,
      });
      return;
    }

    // 古い画像URLを取得
    const oldMainImageUrl = rows[rowIndex - 1][3];
    const oldThumbnailUrl = rows[rowIndex - 1][4];

    let mainImageDriveUrl = oldMainImageUrl;
    let thumbnailDriveUrl = oldThumbnailUrl;

    // サムネイル画像をアップロード（添付がある場合のみ実行）
    if (newThumbnailUrl) {
      const uploadedUrl = await safeUploadImageToDrive(
        drive,
        newThumbnailUrl,
        folderId,
        `${name}-thumb`
      );
      if (uploadedUrl) {
        thumbnailDriveUrl = uploadedUrl;
        if (oldThumbnailUrl) await deleteImageFromDrive(drive, oldThumbnailUrl);
      }
    }

    // メイン画像アップロード
    if (newMainImageUrl) {
      const uploadedUrl = await safeUploadImageToDrive(
        drive,
        newMainImageUrl,
        folderId,
        `${name}-large`
      );
      if (uploadedUrl) {
        mainImageDriveUrl = uploadedUrl;
        if (oldMainImageUrl) await deleteImageFromDrive(drive, oldMainImageUrl);
      }
    }

    // スプレッドシートのデータを更新
    if (newDescription) rows[rowIndex - 1][1] = newDescription;
    if (newUrl) rows[rowIndex - 1][2] = newUrl;
    rows[rowIndex - 1][3] = mainImageDriveUrl;
    rows[rowIndex - 1][4] = thumbnailDriveUrl;
    rows[rowIndex - 1][7] = userId;
    rows[rowIndex - 1][8] = formattedName;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `シート1!A${rowIndex}:I${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rows[rowIndex - 1]] },
    });

    await interaction.editReply({
      content: messages.success[lang],
      flags: 64,
    });
  } catch (error) {
    console.error("エラー:", error);
    await interaction.editReply({
      content: messages.error.fetchError[interaction.locale],
      flags: 64,
    });
  }
}
