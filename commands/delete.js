import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { setupGoogleSheetsAPI } from "../auth.js";

const messages = {
  confirm: {
    ja: "削除確認",
    ko: "삭제 확인",
    "en-US": "Delete Confirmation",
    "zh-TW": "刪除確認",
  },
  description: {
    ja: (name) =>
      `キャラクター「${name}」を本当に削除しますか？\nこの操作は元に戻せません。`,
    ko: (name) =>
      `캐릭터 '${name}'를 정말로 삭제하시겠습니까?\n이 작업은 취소할 수 없습니다.`,
    "en-US": (name) =>
      `Are you sure you want to delete the character '${name}'?\nThis action cannot be undone.`,
    "zh-TW": (name) => `確定要刪除角色 '${name}' 嗎？\n此操作無法撤銷。`,
  },
  removed: {
    ja: "✅キャラクター情報と関連する画像を削除しました。",
    ko: "✅캐릭터 정보 및 관련 이미지를 삭제했습니다.",
    "en-US": "✅Character information and associated images have been removed.",
    "zh-TW": "✅角色資訊及相關圖片已刪除。",
  },
  cancel: {
    ja: "削除をキャンセルしました。",
    ko: "삭제가 취소되었습니다.",
    "en-US": "Deletion has been canceled.",
    "zh-TW": "刪除已取消。",
  },
  timeout: {
    ja: "タイムアウトしました。削除は行われませんでした。",
    ko: "작업이 시간 초과되었습니다. 삭제가 수행되지 않았습니다.",
    "en-US": "The operation timed out. Deletion was not performed.",
    "zh-TW": "操作超時。未執行刪除。",
  },
  errors: {
    notFound: {
      ja: "⚠️指定したキャラクターが見つかりませんでした。",
      ko: "⚠️지정한 캐릭터를 찾을 수 없습니다.",
      "en-US": "⚠️The specified character could not be found.",
      "zh-TW": "⚠️找不到指定的角色。",
    },
    fetchError: {
      ja: "⚠️データ取得中にエラーが発生しました。",
      ko: "⚠️데이터를 가져오는 중 오류가 발생했습니다.",
      "en-US": "⚠️An error occurred while fetching data.",
      "zh-TW": "⚠️獲取資料時發生錯誤。",
    },
  },
};

const buttonLabel = {
  delete: {
    ja: "削除する",
    ko: "삭제",
    "en-US": "Delete",
    "zh-TW": "刪除",
  },
  cancel: {
    ja: "キャンセル",
    ko: "취소",
    "en-US": "Cancel",
    "zh-TW": "取消",
  },
};

export const data = new SlashCommandBuilder()
  .setName("delete")
  .setDescription("キャラクター情報を削除する")
  .setDescriptionLocalizations({
    ko: "캐릭터 정보를 삭제합니다",
    "en-US": "Deleting character information",
    "zh-TW": "刪除角色資訊",
  })
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("削除するキャラクターの名前")
      .setDescriptionLocalizations({
        ko: "삭제할 캐릭터의 이름",
        "en-US": "Name of the character to delete",
        "zh-TW": "要刪除的角色名稱",
      })
      .setRequired(true),
  );

// Google Driveの画像を削除
async function deleteImageFromDrive(driveService, fileId) {
  try {
    if (!fileId) return;
    await driveService.files.delete({ fileId });
    console.log(`画像削除成功: ${fileId}`);
  } catch (error) {
    console.warn(`画像削除失敗(続行): ${fileId}`, error.message);
  }
}

// フォルダ内でファイルを検索
async function getFileIdsFromFolder(drive, folderId, imageUrls) {
  const fileIds = [];
  for (const imageUrl of imageUrls) {
    const match = imageUrl.match(/\/d\/(.*?)\//);
    if (match && match[1]) {
      const fileId = match[1];
      try {
        const fileMetadata = await drive.files.get({
          fileId,
          fields: "parents",
        });
        if (
          fileMetadata.data.parents &&
          fileMetadata.data.parents.includes(folderId)
        ) {
          fileIds.push(fileId);
        }
      } catch (error) {
        console.warn(`ファイル情報の取得に失敗: ${fileId}`, error.message);
      }
    } else {
      console.warn(`画像URLの形式が不正です: ${imageUrl}`);
    }
  }
  return fileIds;
}

export async function execute(interaction) {
  const supportedLangs = ["ja", "ko", "en-US", "zh-TW"];
  const lang = supportedLangs.includes(interaction.locale) ? interaction.locale : "ja";
  const name = interaction.options.getString("name");

  try {    
    const { sheets, drive } = await setupGoogleSheetsAPI();
    const SPREADSHEET_ID = "1A4kmhZo9ZGlr4IZZiPSnUoo7p9FnSH9ujn0Bij7euY4";
    const FOLDER_ID = "1XC1Ny2tsC6mA05dxM6dZ-cpv743E1vh8";

    // スプレッドシートの内容を取得
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "シート1!A:G",
    });

    const rows = data.values;
    let rowIndex = -1;
    let imageUrls = [];

    // キャラクター名で行を検索
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === name) {
        rowIndex = i + 1; // Google Sheetsは1から始まる
        // 画像URL（D列、E列）を取得
        if (rows[i][3]) imageUrls.push(rows[i][3]); // D列（画像URL）
        if (rows[i][4]) imageUrls.push(rows[i][4]); // E列（画像URL）
        break;
      }
    }

    if (rowIndex === -1) {
      return interaction.reply({
        content: messages.errors.notFound[lang],
        ephemeral: true,
      });
    }

    // シートIDを取得
    const spreadsheetMeta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const SHEET_ID = spreadsheetMeta.data.sheets[0].properties.sheetId;

    // 確認メッセージとボタンを送信
    const embed = new EmbedBuilder()
      .setTitle(messages.confirm[lang])
      .setDescription(messages.description[lang](name))
      .setColor("#FF0000");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_delete")
        .setLabel(buttonLabel.delete[lang] || buttonLabel.delete.ja)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("cancel_delete")
        .setLabel(buttonLabel.cancel[lang] || buttonLabel.cancel.ja)
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
    const message = await interaction.fetchReply();
    
    const collector = message.createMessageComponentCollector({
      filter,
      time: 15000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "confirm_delete") {
        try {
          // フォルダ内で画像ファイルを検索
          const fileIdsToDelete = await getFileIdsFromFolder(
            drive,
            FOLDER_ID,
            imageUrls,
          );
    
          // ファイル削除（失敗しても続行）
          for (const fileId of fileIdsToDelete) {
            try {
              await deleteImageFromDrive(drive, fileId);
            } catch (error) {
              console.warn(`画像削除失敗（続行）: ${fileId}`, error.message);
            }
          }
    
          // スプレッドシートの行を削除（常に実行）
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
              requests: [
               {
                 deleteDimension: {
                   range: {
                     sheetId: SHEET_ID,
                     dimension: "ROWS",
                     startIndex: rowIndex - 1,
                     endIndex: rowIndex,
                   },
                 },
               },
             ],
           },
          });
          // メッセージ更新（エラー回避のため replied チェック）
          try {
            if (i.replied || i.deferred) {
              await i.update({
                content: messages.removed[lang],
                ephemeral: true,
              });
            } else {
              await i.update({
                content: messages.removed[lang],
                embeds: [],
                components: [],
              });
            }
          } catch (err) {
            console.error("メッセージ更新エラー:", err);
          }
        } catch (error) {
          console.error("削除処理中のエラー:", error.message);
          try {
            if (i.replied || i.deferred) {
              await i.followUp({
                content: `⚠️削除処理中にエラーが発生しました。\n${error.message}`,
                ephemeral: true,
              });
            } else {
              await i.update({
                content: `⚠️削除処理中にエラーが発生しました。\n${error.message}`,
                embeds: [],
                components: [],
              });
            }
          } catch (e) {
            console.error("エラーメッセージ送信失敗:", e);
          }
        }
      } else if (i.customId === "cancel_delete") {
        try {
          if (i.replied || i.deferred) {
            await i.followUp({
              content: messages.cancel[lang],
              ephemeral: true,
            });
          } else {
            await i.update({
              content: messages.cancel[lang],
              embeds: [],
              components: [],
            });
          }
        } catch (e) {
          console.error("キャンセルメッセージ送信失敗:", e);
        }
      }
    });
    collector.on("end", (collected) => {
      if (collected.size === 0) {
        interaction.editReply({
          content: messages.timeout[lang],
          embeds: [],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("confirm_delete")
                .setLabel(buttonLabel.delete[lang] || buttonLabel.delete.ja)
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId("cancel_delete")
                .setLabel(buttonLabel.cancel[lang] || buttonLabel.cancel.ja)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            ),
          ],
        });
      }
    });
  } catch (error) {
    console.error("エラー:", error);
    const errorMessage = messages.errors.fetchError[lang] || messages.errors.fetchError.ja;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: errorMessage,
        ephemeral: true,
      });
    } else {
      await interaction.editReply({
        content: errorMessage,
        ephemeral: true,
      });
    }
  }
}
