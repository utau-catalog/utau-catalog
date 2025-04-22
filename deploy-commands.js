import { REST, Routes } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const commands = [];
const commandsPath = path.join(process.cwd(), "commands");
const commandFiles = fs
 .readdirSync(commandsPath)
 .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
 const filePath = path.join(commandsPath, file);
 const command = await import(`./commands/${file}`);
 if ("data" in command && "execute" in command) {
  commands.push(command.data.toJSON());
 } else {
  console.warn(`[WARNING] ${file} に "data" または "execute" がありません。`);
 }
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

try {
 console.log(`🔁 スラッシュコマンドを ${commands.length} 件登録中...`);
 const data = await rest.put(
  Routes.applicationGuildCommands(
   process.env.CLIENT_ID,
   process.env.GUILD_ID,
  ),
  { body: commands },
 );
 console.log(`✅ ${data.length} 件のコマンドを登録しました。`);
} catch (error) {
 console.error("❌ コマンド登録エラー:", error);
}
