import TelegramBot from "node-telegram-bot-api";

let bot: TelegramBot | null = null;

export function getTelegramBot(): TelegramBot {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === "your_key_here") {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  if (!bot) {
    bot = new TelegramBot(token, { polling: false });
  }
  return bot;
}
