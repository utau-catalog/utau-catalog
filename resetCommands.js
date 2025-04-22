import { Client, GatewayIntentBits } from "discord.js";
import { config } from "dotenv";
config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  const application = client.application;

  try {
    // ✅ グローバルコマンドをリセット（すべて削除）
    await application.commands.set([]);
    console.log("🌍 グローバルコマンドを全削除しました");

    // ✅ 任意のギルドコマンドをリセット（開発用）
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (guild) {
      await guild.commands.set([]);
      console.log(`🏠 ギルド(${guild.name})のコマンドも全削除しました`);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ コマンド削除に失敗しました", err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
