require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const handleStartCommand = require('./commands/start');
const handleLanguageSelection = require('./handlers/languageHandler');
const handleCallbackQueryRussian = require('./handlers/callbackHandlerRussian');
const handleCallbackQueryEnglish = require('./handlers/callbackHandlerEnglish');
const handleMyProfileCommand = require('./commands/myProfile');

// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
    handleStartCommand(bot, msg); // Обрабатываем команду /start
});

bot.onText(/\/myProfile/, (msg) => {
    handleMyProfileCommand(bot, msg);
});

// Хранилище для языковых предпочтений пользователей
const userLanguages = {}; // Словарь для хранения языков пользователей

// Обработчик callback кнопок
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    // Проверяем, выбрал ли пользователь язык
    if (data === 'language_russian' || data === 'language_english') {
        // Обрабатываем выбор языка и сохраняем его в словаре
        await handleLanguageSelection(bot, callbackQuery);

        // Сохраняем выбранный язык в словаре
        userLanguages[chatId] = data === 'language_russian' ? 'Русский' : 'English';

    } else {
        // Получаем язык пользователя из хранилища
        const userLanguage = userLanguages[chatId] || 'Русский'; // По умолчанию Русский

        // В зависимости от языка вызываем соответствующий обработчик
        if (userLanguage === 'English') {
            await handleCallbackQueryEnglish(bot, callbackQuery);
        } else {
            await handleCallbackQueryRussian(bot, callbackQuery);
        }
    }
});

module.exports = bot;
