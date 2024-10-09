require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const handleCallbackQuery = require('./handlers/callbackHandler');
const handleStartCommand = require('./commands/start');

// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Обработчик callback кнопок
bot.on('callback_query', (callbackQuery) => handleCallbackQuery(bot, callbackQuery));

module.exports = bot;
