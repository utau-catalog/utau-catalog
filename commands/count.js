export async function execute(interaction) {
  await interaction.deferReply(); // ← これを真っ先に実行

  try {
    // 以下はすべてその後に処理する
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
