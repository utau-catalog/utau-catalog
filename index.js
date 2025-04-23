// index.js
import { Client, Collection, GatewayIntentBits } from "discord.js";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
import http from "http";

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running.\n");
}).listen(PORT, () => {
  console.log(`Dummy server is listening on port ${PORT}`);
});

// ESM用 __dirname 互換
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// クライアントの作成
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// コマンドコレクションを用意
client.commands = new Collection();

// commands フォルダーのコマンドを読み込み
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const { data, execute } = await import(`file://${filePath}`);
  if (data && execute) {
    client.commands.set(data.name, { data, execute });
  } else {
    console.warn(
      `[警告] コマンドファイル ${file} に data または execute がありません`,
    );
  }
}

// イベント：Bot起動
client.once("ready", () => {
  console.log(`✅Botは起きています！ ログイン名: ${client.user.tag}`);
});

// イベント：コマンドの処理
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "⚠️コマンドの実行中にエラーが発生しました。",
      flags: 64,
    });
  }
});

// Botログイン
client.login(process.env.DISCORD_TOKEN);

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
