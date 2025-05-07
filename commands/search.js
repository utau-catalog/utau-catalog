import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} from "discord.js";
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
    "zh-TW": (name) => `⚠️找不到名為「${name}」的角色。`,
  },
  fetchError: {
    ja: "⚠️データ取得中にエラーが発生しました。",
    ko: "⚠️데이터를 가져오는 중 오류가 발생했습니다.",
    "en-US": "⚠️An error occurred while fetching data.",
    "zh-TW": "⚠️獲取資料時發生錯誤。",
  },
};

const uiMessages = {
  placeholderText: {
    ja: "キャラクターを選んでください",
    ko: "캐릭터를 선택하세요",
    "en-US": "Please select a character",
    "zh-TW": "請選擇一個角色",
  },
  noDescription: {
    ja: "説明なし",
    ko: "설명 없음",
    "en-US": "No description",
    "zh-TW": "無描述",
  },
  multipleMatches: {
    ja: "🔍 該当するキャラクターが複数見つかりました。選んでください：",
    ko: "🔍 해당하는 캐릭터가 여러 명 발견되었습니다. 선택해주세요:",
    "en-US": "🔍 Multiple matching characters found. Please select one:",
    "zh-TW": "🔍 找到多個相符的角色。請選擇其中一個：",
  },
  noChannel: {
    ja: "⚠️メッセージチャンネルが見つかりません。",
    ko: "⚠️메시지 채널을 찾을 수 없습니다.",
    "en-US": "⚠️Message channel not found.",
    "zh-TW": "⚠️找不到訊息頻道。",
  },
  unauthorizedUser: {
    ja: "⚠️このメニューはコマンドを実行したユーザー専用です。他の方は操作できません。",
    ko: "⚠️이 메뉴는 명령을 실행한 사용자 전용입니다. 다른 사용자는 조작할 수 없습니다.",
    "en-US": "⚠️This menu is only for the user who ran the command. Others cannot use it.",
    "zh-TW": "⚠️此選單僅限執行指令的使用者使用，其他人無法操作。",
  },
  timeout: {
    ja: "⚠️時間切れです。もう一度検索してください。",
    ko: "⚠️시간 초과입니다. 다시 검색해주세요.",
    "en-US": "⚠️Timed out. Please try searching again.",
    "zh-TW": "⚠️操作逾時。請重新搜尋。",
  },
  generalError: {
    ja: "⚠️エラーが発生しました。",
    ko: "⚠️오류가 발생했습니다.",
    "en-US": "⚠️An error has occurred.",
    "zh-TW": "⚠️發生錯誤。",
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
  const supportedLangs = ["ja", "ko", "en-US", "zh-TW"];
  const lang = supportedLangs.includes(interaction.locale) ? interaction.locale : "ja";
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
    
    const normalize = (text) => text?.toLowerCase().replace(/\s/g, "").normalize("NFKC");
    const input = normalize(name);
    
    // 完全一致を探す
    const matchedRow = rows.find((row) => normalize(row[0]) === input);
    // 一部一致を探す
    const partialMatches = rows.filter((row) => row[0]?.toLowerCase().includes(name.toLowerCase()));
    
    if (matchedRow) {
      return await sendCharacterEmbed(interaction, matchedRow);
    }

    if (partialMatches.length === 0) {
      const errorMessage = errorMessages.notFound[lang](name);
      return await interaction.editReply(errorMessage);
    }
    
    if (partialMatches.length === 1) {
      return await sendCharacterEmbed(interaction, partialMatches[0]);
    }

    // 複数候補 → セレクトメニューを表示
    const options = partialMatches.slice(0, 25).map((row, index) => ({
      label: (row[0] || `No name ${index}`).slice(0, 100),
      ddescription: (row[1] || uiMessages.noDescription[lang]).slice(0, 100),
      value: index.toString(),
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_character")
      .setPlaceholder(uiMessages.placeholderText[lang])
      .addOptions(options);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.editReply({
      content: uiMessages.multipleMatches[lang],
      components: [row],
    });

    // コレクターでユーザーの選択を待機
    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.StringSelect ?? 3,
      time: 15000, // 15秒でタイムアウト
      max: 1,
    });
    
    collector.on("collect", async (i) => {
      if (!interaction.channel) {
        await interaction.editReply(uiMessages.noChannel[lang]);
        return;
      }
      if (i.user.id !== interaction.user.id) {
        return await i.reply({
          content: uiMessages.unauthorizedUser[lang],
          flags: 64
        });
      }
    
      const selectedIndex = parseInt(i.values[0]);
      const selectedRow = partialMatches[selectedIndex];
    
      await i.update({ components: [] });
      await sendCharacterEmbed(interaction, selectedRow);
    });
    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        await interaction.editReply({
          content: uiMessages.timeout[lang],
          components: [],
        });
      }
    });
  } catch (error) {
    console.error("エラー:", error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: uiMessages.generalError[lang],
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
function convertGoogleDriveLink(link) {
  const match = link?.match(/\/file\/d\/([-_\w]+)\//);
  return match ? `https://drive.google.com/uc?id=${match[1]}` : link;
}
function createEmbed(row) {
  const embed = new EmbedBuilder()
    .setTitle(row[0])
    .setDescription(row[1] || "")
    .setColor("#54e8e6");

  const mainImage = convertGoogleDriveLink(row[3]);
  const thumb = convertGoogleDriveLink(row[4]);

  if (mainImage) embed.setImage(mainImage);
  if (thumb) embed.setThumbnail(thumb);
  if (row[2]) {
    embed.addFields([{ name: "配布所URL", value: row[2], inline: false }]);
  }
  return embed;
}
async function sendCharacterEmbed(interaction, row) {
  const embed = createEmbed(row);
  await interaction.editReply({ content: "", embeds: [embed], components: [] });
}
