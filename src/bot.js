require('dotenv').config();
const db = require('./config/db'); // Импорт базы данных
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
const handleChangeTextRussian = require('./cabinet/notificationHandler/handleChangeTextRussian');

const handleNotificationsEnglish = require('./cabinet/notificationHandler/handleNotificationsEnglish');
const handleChangeNotificationEnglish = require('./cabinet/notificationHandler/handleChangeNotificationEnglish');
const handleChangeTimeEnglish = require('./cabinet/notificationHandler/handleChangeTimeEnglish');
const handleSetTimeEnglish = require('./cabinet/notificationHandler/handleSetTimeEnglish');
const handleChangeTextEnglish = require('./cabinet/notificationHandler/handleChangeTextEnglish');

// Импорт обработчиков для связи с врачом
const handleDoctorConnectionRussian = require('./cabinet/doctorConnection/doctorConnectionRussian');
const handleSendMessageRussian = require('./cabinet/doctorConnection/sendMessageRussian');
const handleViewMessagesRussian = require('./cabinet/doctorConnection/viewMessagesRussian');

const handleDoctorConnectionEnglish = require('./cabinet/doctorConnection/doctorConnectionEnglish');
const handleSendMessageEnglish = require('./cabinet/doctorConnection/sendMessageEnglish');
const handleViewMessagesEnglish = require('./cabinet/doctorConnection/viewMessagesEnglish');

const {seizureCalendarRussian,
    handleChangeMonthRussian}= require('./cabinet/calendar/seizureCalendarRussian');
const seizureCalendarEnglish = require('./cabinet/calendar/seizureCalendarEnglish');

// Функция для проверки и создания таблиц
const initializeDatabase = async () => {
    // (Логика проверки и создания таблиц)
};

// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Вызов функции инициализации базы данных
initializeDatabase().then(() => {
    // Обработчик команды /start
    bot.onText(/\/start/, (msg) => {
        handleStartCommand(bot, msg);
    });

    scheduleNotifications(bot);

    bot.onText(/\/myProfile/, (msg) => {
        handleMyProfileCommand(bot, msg);
    });

    // Хранилище для языковых предпочтений пользователей
    const userLanguages = {};

    // Обработчик callback кнопок
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;

        // Инициализация userMessageIds
        if (!bot.userMessageIds) {
            bot.userMessageIds = {};
        }

        // Проверяем, выбрал ли пользователь язык
        if (data === 'language_russian' || data === 'language_english') {
            await handleLanguageSelection(bot, callbackQuery);
            userLanguages[chatId] = data === 'language_russian' ? 'Русский' : 'English';
        }
        // Информация о болезни
        else if (data === 'info_about_disease') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await informationEnglish(bot, chatId);
            } else {
                await informationRussian(bot, chatId);
            }
        }
        // Возвращение в профиль
        else if (data === 'back_to_profile') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await callbackMyProfileEnglish(bot, { chat: { id: chatId } });
            } else {
                await callbackMyProfileRussian(bot, { chat: { id: chatId } });
            }
        }
        // Обработка уведомлений
        else if (data === 'notifications') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleNotificationsEnglish(bot, chatId);
            } else {
                await handleNotificationsRussian(bot, chatId);
            }
        }
        else if (data === 'change_notification') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleChangeNotificationEnglish(bot, chatId);
            } else {
                await handleChangeNotificationRussian(bot, chatId);
            }
        }
        else if (data === 'change_time') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleChangeTimeEnglish(bot, chatId);
            } else {
                await handleChangeTimeRussian(bot, chatId);
            }
        }
        else if (data === 'change_text') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleChangeTextEnglish(bot, chatId);
            } else {
                await handleChangeTextRussian(bot, chatId);
            }
        }
        else if (data.startsWith('time_morning_edit') || data.startsWith('time_afternoon_edit') || data.startsWith('time_evening_edit')) {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleSetTimeEnglish(bot, chatId, data);
            } else {
                await handleSetTimeRussian(bot, chatId, data);
            }
        }

// Обработка команды /seizure_calendar
        else if (data === 'seizure_calendar') {
            const userLanguage = userLanguages[chatId] || 'Русский';

            // Отправляем сообщение и сохраняем его идентификатор
            const message = await bot.sendMessage(chatId, 'Ваш календарь приступов\n\nЕсли в календаре уже есть запись, то значок покажет, был ли у вас приступ:\n🔸 — Приступ без приема препаратов\n🔺 — Приступ с препаратами', {
                reply_markup: {
                    inline_keyboard: [] // Здесь должны быть ваши кнопки
                }
            });

            // Сохраняем идентификатор сообщения
            bot.userMessageIds[chatId] = message.message_id;

            if (userLanguage === 'English') {
                await seizureCalendarEnglish(bot, chatId);
            } else {
                await seizureCalendarRussian(bot, chatId, message.message_id); // Передаем messageId
            }
        }

        // Обработка команды 'seizure_calendar'
        else if (data === 'seizure_calendar') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            let message;

            // Вызов функции для отправки календаря в зависимости от языка
            if (userLanguage === 'English') {
                message = await seizureCalendarEnglish(bot, chatId); // Сохраняем объект сообщения
            } else {
                message = await seizureCalendarRussian(bot, chatId); // Сохраняем объект сообщения
            }

            // Сохраняем идентификатор сообщения для редактирования
            bot.userMessageIds[chatId] = message.message_id;
        }

        // Обработка изменения месяца
        else if (data.startsWith('change_month_')) {
            const monthOffset = parseInt(data.split('_')[2]);
            const userLanguage = userLanguages[chatId] || 'Русский';
            const messageId = bot.userMessageIds[chatId]; // Получаем сохраненный message_id

            // Проверка языка и вызов соответствующей функции для изменения месяца
            if (userLanguage === 'English') {
                await handleChangeMonthEnglish(bot, chatId, monthOffset, messageId); // Передаем message_id
            } else {
                await handleChangeMonthRussian(bot, chatId, monthOffset, messageId); // Передаем message_id
            }

            await bot.answerCallbackQuery(callbackQuery.id); // Подтверждаем нажатие кнопки
        }

        // Добавляем обработчики для связи с врачом
        else if (data === 'doctor_connection') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleDoctorConnectionEnglish(bot, chatId);
            } else {
                await handleDoctorConnectionRussian(bot, chatId);
            }
        }
        else if (data === 'send_message') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleSendMessageEnglish(bot, chatId);
            } else {
                await handleSendMessageRussian(bot, chatId);
            }
        }
        else if (data === 'view_messages') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleViewMessagesEnglish(bot, chatId);
            } else {
                await handleViewMessagesRussian(bot, chatId);
            }
        }
        else {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleCallbackQueryEnglish(bot, callbackQuery);
            } else {
                await handleCallbackQueryRussian(bot, callbackQuery);
            }
        }
    });
}).catch(err => {
    console.error('Ошибка инициализации базы данных:', err);
});
