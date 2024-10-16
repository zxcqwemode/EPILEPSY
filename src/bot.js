require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const handleStartCommand = require('./commands/start');
const handleLanguageSelection = require('./handlers/languageHandler');
const handleCallbackQueryRussian = require('./handlers/callbackHandlerRussian');
const handleCallbackQueryEnglish = require('./handlers/callbackHandlerEnglish');
const handleMyProfileCommand = require('./commands/myProfile');
const callbackMyProfileRussian = require('./handlers/myProfileRussian');
const callbackMyProfileEnglish = require('./handlers/myProfileEnglish');
const informationRussian = require('./cabinet/informationHandler/informationRussian');
const informationEnglish = require('./cabinet/informationHandler/informationEnglish');
const scheduleNotifications = require('./cabinet/notificationHandler/notifications');

// Импортируем обработчики для управления уведомлениями
const handleNotificationsRussian = require('./cabinet/notificationHandler/handleNotificationsRussian');
const handleChangeNotificationRussian = require('./cabinet/notificationHandler/handleChangeNotificationRussian');
const handleChangeTimeRussian = require('./cabinet/notificationHandler/handleChangeTimeRussian');
const handleSetTimeRussian = require('./cabinet/notificationHandler/handleSetTimeRussian');

const handleNotificationsEnglish = require('./cabinet/notificationHandler/handleNotificationsEnglish');
const handleChangeNotificationEnglish = require('./cabinet/notificationHandler/handleChangeNotificationEnglish');
const handleChangeTimeEnglish = require('./cabinet/notificationHandler/handleChangeTimeEnglish');
const handleSetTimeEnglish = require('./cabinet/notificationHandler/handleSetTimeEnglish');

// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
scheduleNotifications(bot);

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
    handleStartCommand(bot, msg);
});

bot.onText(/\/myProfile/, (msg) => {
    handleMyProfileCommand(bot, msg);
});

// Хранилище для языковых предпочтений пользователей
const userLanguages = {};

// Обработчик callback кнопок
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    // Проверяем, выбрал ли пользователь язык
    if (data === 'language_russian' || data === 'language_english') {
        await handleLanguageSelection(bot, callbackQuery);
        userLanguages[chatId] = data === 'language_russian' ? 'Русский' : 'English';
    } else if (data === 'info_about_disease') {
        const userLanguage = userLanguages[chatId] || 'Русский';
        if (userLanguage === 'English') {
            await informationEnglish(bot, chatId);
        } else {
            await informationRussian(bot, chatId);
        }
    } else if (data === 'back_to_profile') {
        const userLanguage = userLanguages[chatId] || 'Русский';
        if (userLanguage === 'English') {
            await callbackMyProfileEnglish(bot, { chat: { id: chatId } });
        } else {
            await callbackMyProfileRussian(bot, { chat: { id: chatId } });
        }
    } else if (data === 'notifications') {
        const userLanguage = userLanguages[chatId] || 'Русский';
        if (userLanguage === 'English') {
            await handleNotificationsEnglish(bot, chatId);
        } else {
            await handleNotificationsRussian(bot, chatId);
        }
    } else if (data === 'change_notification') {
        const userLanguage = userLanguages[chatId] || 'Русский';
        if (userLanguage === 'English') {
            await handleChangeNotificationEnglish(bot, chatId);
        } else {
            await handleChangeNotificationRussian(bot, chatId);
        }
    } else if (data === 'change_time') {
        const userLanguage = userLanguages[chatId] || 'Русский';
        if (userLanguage === 'English') {
            await handleChangeTimeEnglish(bot, chatId);
        } else {
            await handleChangeTimeRussian(bot, chatId);
        }
    } else if (data.startsWith('time_morning_edit') || data.startsWith('time_afternoon_edit') || data.startsWith('time_evening_edit')) {
        const userLanguage = userLanguages[chatId] || 'Русский';
        if (userLanguage === 'English') {
            await handleSetTimeEnglish(bot, chatId, data); // Передаем callbackData
        } else {
            await handleSetTimeRussian(bot, chatId, data); // Передаем callbackData
        }
    } else {
        const userLanguage = userLanguages[chatId] || 'Русский';
        if (userLanguage === 'English') {
            await handleCallbackQueryEnglish(bot, callbackQuery);
        } else {
            await handleCallbackQueryRussian(bot, callbackQuery);
        }
    }
});

module.exports = bot;
