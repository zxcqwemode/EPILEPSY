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

// Функция для проверки и создания таблиц
const initializeDatabase = async () => {
    const checkUsersTable = `
        SELECT EXISTS (
            SELECT FROM pg_tables 
            WHERE tablename = 'users'
        );
    `;

    const checkDoctorsTable = `
        SELECT EXISTS (
            SELECT FROM pg_tables 
            WHERE tablename = 'doctors'
        );
    `;

    const checkMessagesTable = `
        SELECT EXISTS (
            SELECT FROM pg_tables 
            WHERE tablename = 'messages'
        );
    `;

    const usersTableExists = await db.query(checkUsersTable);
    const doctorsTableExists = await db.query(checkDoctorsTable);
    const messagesTableExists = await db.query(checkMessagesTable);

    // Если таблицы не существуют, создаем их
    if (!usersTableExists.rows[0].exists) {
        const createUsersTable = `
            CREATE TABLE users (
                chat_id BIGINT PRIMARY KEY,
                language VARCHAR(50),
                gender VARCHAR(50),
                timezone_gmt INTEGER,
                notification_period VARCHAR(50),
                notification_hour_msk INTEGER,
                notification_hour_gmt INTEGER,
                step VARCHAR(50),
                notification_text VARCHAR(50),
                doctor_key VARCHAR(255),
                key_valid BOOLEAN DEFAULT FALSE
            );
        `;
        await db.query(createUsersTable);
        console.log("Таблица 'users' была создана.");
    }

    if (!doctorsTableExists.rows[0].exists) {
        const createDoctorsTable = `
            CREATE TABLE doctors (
                chat_id BIGINT PRIMARY KEY,
                language VARCHAR(50),
                doctor_key VARCHAR(50)
           
            );
        `;
        await db.query(createDoctorsTable);
        console.log("Таблица 'doctors' была создана.");
    }

    if (!messagesTableExists.rows[0].exists) {
        const createMessagesTable = `
            CREATE TABLE messages (
                message_id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                doctor_key VARCHAR(50) NOT NULL,
                message_text TEXT NOT NULL,
                message_date TIMESTAMP DEFAULT NOW(),
                FOREIGN KEY (user_id) REFERENCES users (chat_id)
            );
        `;
        await db.query(createMessagesTable);
        console.log("Таблица 'messages' была создана.");
    }
};

// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Вызов функции инициализации базы данных
initializeDatabase().then(() => {
    //Обработчик команды /start
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

        } else if (data === 'change_text') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleChangeTextEnglish(bot, chatId);
            } else {
                await handleChangeTextRussian(bot, chatId);
            }

        } else if (data.startsWith('time_morning_edit') || data.startsWith('time_afternoon_edit') || data.startsWith('time_evening_edit')) {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleSetTimeEnglish(bot, chatId, data); // Передаем callbackData
            } else {
                await handleSetTimeRussian(bot, chatId, data); // Передаем callbackData
            }
        }
        // Добавляем обработчики для связи с врачом
        else if (data === 'doctor_connection') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleDoctorConnectionEnglish(bot, chatId);
            } else {
                await handleDoctorConnectionRussian(bot, chatId);
            }

        } else if (data === 'send_message') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleSendMessageEnglish(bot, chatId);
            } else {
                await handleSendMessageRussian(bot, chatId);
            }

        } else if (data === 'view_messages') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await handleViewMessagesEnglish(bot, chatId);
            } else {
                await handleViewMessagesRussian(bot, chatId);
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
}).catch(err => {
    console.error('Ошибка инициализации базы данных:', err);
});
