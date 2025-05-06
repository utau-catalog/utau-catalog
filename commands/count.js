import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("count")
  .setDescription("現在の登録数を返します");

export async function execute(interaction) {
  await interaction.deferReply();
  try {
    
    // テスト用に固定値でEmbedを返す
    const embed = new EmbedBuilder()
      .setTitle("現在の登録数")
      .setDescription("登録数は **123 件** です（テスト用）")
      .setColor("#54e8e6");

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("エラー:", error);
    await interaction.editReply("⚠️ エラーが発生しました。");
  }
}
