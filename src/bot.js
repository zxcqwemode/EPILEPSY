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
const NotificationHandlersRussian = require('./cabinet/notificationHandler/notificationHandlersRussian');
const NotificationHandlersEnglish = require('./cabinet/notificationHandler/notificationHandlersEnglish');

// Импорт обработчиков для связи с врачом
const DoctorPatientHandlerRussian = require('./cabinet/doctorConnection/DoctorPatientHandlerRussian');
const DoctorPatientHandlerEnglish = require('./cabinet/doctorConnection/DoctorPatientHandlerEnglish');


const {seizureCalendarRussian,
    handleChangeMonthRussian,
    handleDayPressRussian,
    startRecordingRussian}= require('./cabinet/calendar/seizureCalendarRussian');
const seizureCalendarEnglish = require('./cabinet/calendar/seizureCalendarEnglish');

const seizureRussian = require('./cabinet/seizure/seizureRussian');
const seizureEnglish = require('./cabinet/seizure/seizureEnglish');

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
    const calendarTableExists = await db.query(`
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'calendar'
    );
`);
    if (!calendarTableExists.rows[0].exists) {
        const createCalendarTable = `
        CREATE TABLE calendar (
            id SERIAL PRIMARY KEY,
            user_id BIGINT,
            date DATE,
            had_seizure BOOLEAN,
            seizure_duration VARCHAR(255),
            seizure_description TEXT,
            trigger VARCHAR(255),
            repeated_seizures VARCHAR(255),
            note BOOLEAN NOT NULL DEFAULT false,
            note_text TEXT,
            created_at TIMESTAMP,
            UNIQUE (user_id, date)
        );
    `;
        await db.query(createCalendarTable);
        console.log("Таблица 'calendar' была создана.");
    }
    const usersTableExists = await db.query(checkUsersTable);
    const doctorsTableExists = await db.query(checkDoctorsTable);
    const messagesTableExists = await db.query(checkMessagesTable);

    // Если таблицы не существуют, создаем их
    if (!usersTableExists.rows[0].exists) {
        const createUsersTable = `
            CREATE TABLE users (
                chat_id BIGINT PRIMARY KEY,
                name VARCHAR(50),
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
                doctor_key VARCHAR(50),
                awaiting_message_for BIGINT
           
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
                file_id TEXT,
                file_type TEXT,
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

const doctorHandlerRussian = new DoctorPatientHandlerRussian(bot);
const doctorHandlerEnglish = new DoctorPatientHandlerEnglish(bot);
const handler = new DoctorPatientHandlerRussian(bot);
await handler.init();

seizureRussian.setupCallbackHandler(bot);
seizureEnglish.setupCallbackHandler(bot);

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

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;

        // Получаем язык пользователя из базы данных
        const userResult = await db.query('SELECT language FROM users WHERE chat_id = $1', [chatId]);
        const userLanguage = userResult.rows[0]?.language;

        if (userLanguage === 'English') {
            await doctorHandlerEnglish.handleMessageEnglish(msg);
        } else {
            await doctorHandlerRussian.handleMessageRussian(msg);
        }
    });


    // Хранилище для языковых предпочтений пользователей
    const userLanguages = {};

    bot.on('back_to_profile', async (chatId) => {
        const userResult = await db.query('SELECT language FROM users WHERE chat_id = $1', [chatId]);
        const userLanguage = userResult.rows[0]?.language;

        if (userLanguage === 'English') {
            await callbackMyProfileEnglish(bot, { chat: { id: chatId } });
        } else {
            await callbackMyProfileRussian(bot, { chat: { id: chatId } });
        }
    });

    // Обработчик callback кнопок
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        const userResult = await db.query('SELECT language FROM users WHERE chat_id = $1', [chatId]);
        const userLanguage = userResult.rows[0]?.language;

        // Инициализация userMessageIds
        // if (!bot.userMessageIds) {
        //     bot.userMessageIds = {};
        // }

        //Проверяем, выбрал ли пользователь язык
        if (data === 'language_russian' || data === 'language_english') {
            await handleLanguageSelection(bot, callbackQuery);
            userLanguages[chatId] = data === 'language_russian' ? 'Русский' : 'English';
        }

        // Обработка doctor_connection и связанных callback'ов должна идти первой
        if (data === 'doctor_connection' ||
            data === 'view_messages' ||
            data === 'send_message' ||
            data === 'change_doctor' ||
            data === 'retry_key') {
            if (userLanguage === 'English') {
                await doctorHandlerEnglish.handleCallbackEnglish(callbackQuery);
            } else {
                await doctorHandlerRussian.handleCallbackRussian(callbackQuery);
            }
            return;
        }

        // Находим этот блок в существующем коде
        else if (data.startsWith('start_timer_seizure')){
            const userLanguage = userLanguages[chatId] || 'Русский';
            const messageId = callbackQuery.message.message_id;
            if (userLanguage === 'English') {
                await seizureEnglish(bot, chatId, messageId); // Раскомментируйте когда добавите английскую версию
            } else {
                await seizureRussian(bot, chatId, messageId);
            }
        }

        // Информация о болезни
        else if (data === 'info_about_disease') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            const messageId = callbackQuery.message.message_id; // Получаем ID сообщения, которое будет изменено

            if (userLanguage === 'English') {
                await informationEnglish(bot, chatId, messageId);
            } else {
                await informationRussian(bot, chatId, messageId); // Передаем messageId
            }
        }
        // Возвращение в профиль
        else if (data === 'back_to_profile') {
            await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id
            });
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
            const messageId = callbackQuery.message.message_id; // Получаем ID сообщения, которое будет изменено

            if (userLanguage === 'English') {
                await NotificationHandlersEnglish(bot, callbackQuery.message.chat.id, callbackQuery.message.message_id);
            } else {
                await NotificationHandlersRussian(bot, callbackQuery.message.chat.id, callbackQuery.message.message_id);
            }
        }

        //Обработка команды /seizure_calendar
        else if (data === 'seizure_calendar') {
            const messageId = callbackQuery.message.message_id; // Получаем ID сообщения, которое будет изменено
            const userLanguage = userLanguages[chatId] || 'Русский';

            // Вызываем обработчик в зависимости от языка и передаем message_id
            if (userLanguage === 'English') {
                await seizureCalendarEnglish(bot, chatId, messageId);
            } else {
                await seizureCalendarRussian(bot, chatId, messageId);
            }
        }

        // Обработка нажатия на день в календаре
        else if (data.startsWith('calendar_')) {
            const [_, day, monthOffset] = data.split('_');
            const userLanguage = userLanguages[chatId] || 'Русский';
            const messageId = callbackQuery.message.message_id;
            if (userLanguage === 'English') {
                await handleDayPressEnglish(bot, chatId, day, monthOffset, messageId);
            } else {
                await handleDayPressRussian(bot, chatId, day, monthOffset, messageId);
            }
        }

        //Обработка изменения месяца
        else if (data.startsWith('change_month_')) {
            const monthOffset = parseInt(data.split('_')[2]);
            const userLanguage = userLanguages[chatId] || 'Русский';
            const messageId = callbackQuery.message.message_id;

            if (userLanguage === 'English') {
                await handleChangeMonthEnglish(bot, chatId, monthOffset, messageId);
            } else {
                await handleChangeMonthRussian(bot, chatId, monthOffset, messageId);
            }

            await bot.answerCallbackQuery(callbackQuery.id);
        }

        // Обработка начала записи на выбранную дату
        else if (data.startsWith('start_record_')) {
            const dateString = data.split('_')[2]; // Получаем дату в формате 2024-10-08T00:00:00.000Z
            const date = dateString.split('T')[0]; // Оставляем только часть YYYY-MM-DD
            const messageId = callbackQuery.message.message_id;
            await startRecordingRussian(bot, chatId, date, messageId);
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
    console.error('Error in callback handler:', err);
});
