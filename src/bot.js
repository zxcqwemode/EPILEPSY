require('dotenv').config();
const db = require('./config/db');
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

const NotificationsRussian = require('./cabinet/notificationHandler/notificationsRussian');
//const { NotificationsEnglish } = require('./cabinet/notificationHandler/notificationsEnglish');
const initNotifications = require('./cabinet/notificationHandler/notifications');

const statisticRussian = require('./cabinet/statistic/statisticRussian');
const statisticEnglish = require('./cabinet/statistic/statisticEnglish');

const {
    handleDoctorMessage,
    handleMenuCommand,
    handleDoctorCallbackRussian,
    handleUnreadMessagesForPatient
} = require('./handlers/doctorOfficeHandlerRussian');
const {
    handleDoctorMessageEnglish,
    handleMenuCommandEnglish,
    handleDoctorCallbackEnglish,
    handleUnreadMessagesForPatientEnglish
} = require('./handlers/doctorOfficeHandlerEnglish');

const DoctorPatientHandlerRussian = require('./cabinet/doctorConnection/doctorPatientHandlerRussian');
const DoctorPatientHandlerEnglish = require('./cabinet/doctorConnection/doctorPatientHandlerEnglish');

const {
    seizureCalendarRussian,
    handleChangeMonthRussian,
    handleDayPressRussian,
    startRecordingRussian
} = require('./cabinet/calendar/seizureCalendarRussian');

const {
    seizureCalendarEnglish,
    handleChangeMonthEnglish,
    handleDayPressEnglish,
    startRecordingEnglish
} = require('./cabinet/calendar/seizureCalendarEnglish');

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

    const checkNotificationsTable = `
    SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE tablename = 'notifications'
    );
`;

    const checkDoctorsTable = `
        SELECT EXISTS (
            SELECT FROM pg_tables 
            WHERE tablename = 'doctors'
        );
    `;

    const checkDoctorsMessagesTable = `
        SELECT EXISTS (
            SELECT FROM pg_tables 
            WHERE tablename = 'doctors_messages'
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
    const checkBansTable = `
    SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE tablename = 'bans'
    );
`;


    const usersTableExists = await db.query(checkUsersTable);
    const notificationsTableExists = await db.query(checkNotificationsTable);
    const doctorsTableExists = await db.query(checkDoctorsTable);
    const messagesTableExists = await db.query(checkMessagesTable);
    const doctorsMessagesTableExists = await db.query(checkDoctorsMessagesTable);
    const bansTableExists = await db.query(checkBansTable);

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

    // Если таблицы не существуют, создаем их
    if (!usersTableExists.rows[0].exists) {
        const createUsersTable = `
            CREATE TABLE users (
                chat_id BIGINT PRIMARY KEY,
                fio VARCHAR(50),
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
    if (!notificationsTableExists.rows[0].exists) {
        const createNotificationsTable = `
        CREATE TABLE notifications (
            id SERIAL PRIMARY KEY,
            user_id BIGINT,
            notification_time VARCHAR(50),
            medication VARCHAR(255),
            dose VARCHAR(100),
            created_at TIMESTAMP DEFAULT NOW(),
            FOREIGN KEY (user_id) REFERENCES users (chat_id)
        );
    `;
        await db.query(createNotificationsTable);
        console.log("Таблица 'notifications' была создана.");
    }

    if (!doctorsMessagesTableExists.rows[0].exists) {
        const createDoctorsMessagesTable = `
            CREATE TABLE doctors_messages (
                message_id SERIAL PRIMARY KEY,
                doctor_id BIGINT,
                patient_id BIGINT,
                message_text TEXT,
                message_date TIMESTAMP DEFAULT NOW(),
                doctor_key VARCHAR(50)
            );
        `;
        await db.query(createDoctorsMessagesTable);
        console.log("Таблица 'doctors_messages' была создана.");
    }

    if (!doctorsTableExists.rows[0].exists) {
        const createDoctorsTable = `
            CREATE TABLE doctors (
                chat_id BIGINT PRIMARY KEY,
                language VARCHAR(255),
                doctor_key VARCHAR(50),
                name VARCHAR(50),
                description VARCHAR(50),
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
                user_id BIGINT,
                doctor_key VARCHAR(50),            
                message_text TEXT,
                message_date TIMESTAMP DEFAULT NOW(),
                isFile BOOLEAN,
                fileName VARCHAR(255),
                filePath VARCHAR(255),
                isRead BOOLEAN,
                sender_type VARCHAR(10) CHECK (sender_type IN ('patient', 'doctor')),
                FOREIGN KEY (user_id) REFERENCES users (chat_id)
            );
        `;
        await db.query(createMessagesTable);
        console.log("Таблица 'messages' была создана.");
    }

    if (!bansTableExists.rows[0].exists) {
        const createBansTable = `
        CREATE TABLE bans (
            id SERIAL PRIMARY KEY,
            user_id BIGINT,
            doctor_key VARCHAR(50),
            CONSTRAINT unique_user_doctor UNIQUE (user_id, doctor_key)

           
        );
    `;
        await db.query(createBansTable);
        console.log("Таблица 'bans' была создана.");
    }


};
// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const doctorHandlerRussian = new DoctorPatientHandlerRussian(bot);
const doctorHandlerEnglish = new DoctorPatientHandlerEnglish(bot);
const handler = new DoctorPatientHandlerRussian(bot);
const handlerEnglish = new DoctorPatientHandlerEnglish(bot);
seizureRussian.setupCallbackHandler(bot);
seizureEnglish.setupCallbackHandler(bot);
const notificationsRussian = new NotificationsRussian(bot);
//const notificationsEnglish = new NotificationsEnglish(bot);






// Хранилище для языковых предпочтений пользователей
const userLanguages = {};

// Вызов функции инициализации базы данных
initializeDatabase().then(() => {
    //notificationsEnglish.setupCallbackHandler(bot);

    notificationsRussian.setupHandlers();
    initNotifications();
    // Обработчик команды /start
    bot.onText(/\/start/, (msg) => {
        handleStartCommand(bot, msg);
    });



    bot.onText(/\/myProfile/, (msg) => {
        handleMyProfileCommand(bot, msg);
    });

    bot.onText(/\/menu/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            const doctorResult = await db.query('SELECT * FROM doctors WHERE chat_id = $1', [chatId]);
            if (doctorResult.rows.length > 0) {
                const doctorLanguage = doctorResult.rows[0].language;
                if (doctorLanguage === 'English') {
                    await handleMenuCommandEnglish(bot, msg);
                } else {
                    await handleMenuCommand(bot, msg);
                }
            }
        } catch (error) {
            console.error('Ошибка при обработке команды /menu:', error);
        }
    });

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;

        // Получаем язык пользователя из базы данных
        const userResult = await db.query('SELECT language FROM users WHERE chat_id = $1', [chatId]);
        const userLanguage = userResult.rows[0]?.language;

        // Проверяем, является ли отправитель врачом
        const doctorResult = await db.query('SELECT * FROM doctors WHERE chat_id = $1', [chatId]);
        const isDoctor = doctorResult.rows.length > 0;

        if (isDoctor) {
            const doctorLanguage = doctorResult.rows[0].language;

            if (doctorLanguage === 'English') {
                await handleDoctorMessageEnglish(bot, msg);
            } else {
                await handleDoctorMessage(bot, msg);
            }
        } else {
            // Существующая логика для обычных пользователей
            const userResult = await db.query('SELECT language FROM users WHERE chat_id = $1', [chatId]);
            const userLanguage = userResult.rows[0]?.language;

            if (userLanguage === 'English') {
                await doctorHandlerEnglish.handleMessageEnglish(msg);
            } else {
                await doctorHandlerRussian.handleMessageRussian(msg);
            }
        }
    });

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

        // Проверяем, является ли пользователь врачом
        const doctorResult = await db.query('SELECT * FROM doctors WHERE chat_id = $1', [chatId]);
        const isDoctor = doctorResult.rows.length > 0;

        if (isDoctor) {
            const doctorLanguage = doctorResult.rows[0].language;
            if (doctorLanguage === 'English') {
                await handleDoctorCallbackEnglish(bot, callbackQuery);
            } else {
                await handleDoctorCallbackRussian(bot, callbackQuery);
            }
            return;
        }

        const userResult = await db.query('SELECT language FROM users WHERE chat_id = $1', [chatId]);
        const userLanguage = userResult.rows[0]?.language;

        await handler.init();
        await handlerEnglish.initEnglish();

        if (data === 'language_russian' || data === 'language_english') {
            await handleLanguageSelection(bot, callbackQuery);
            userLanguages[chatId] = data === 'language_russian' ? 'Русский' : 'English';

        } else if (data === 'doctor_connection' || data === 'view_messages' || data === 'send_message' ||
            data === 'change_doctor' || data === 'retry_key' || data === 'choose_message_type' ||
            data === 'send_text_message' || data === 'send_file' || data === 'doctor_info') {
            if (userLanguage === 'English') {
                await doctorHandlerEnglish.handleCallbackEnglish(callbackQuery);
            } else {
                await doctorHandlerRussian.handleCallbackRussian(callbackQuery);
            }

        } else if (data.startsWith('unread_messages_patient_')) {
            const doctorResult = await db.query('SELECT * FROM doctors WHERE chat_id = $1', [chatId]);
            if (doctorResult.rows.length > 0) {
                const doctorLanguage = doctorResult.rows[0].language;
                const messageId = callbackQuery.message.message_id;

                if (doctorLanguage === 'English') {
                    await handleUnreadMessagesForPatientEnglish(bot, chatId, messageId, data);
                } else {
                    await handleUnreadMessagesForPatient(bot, chatId, messageId, data);
                }
            }

        } else if (data.startsWith('start_timer_seizure')) {
            const userLanguage = userLanguages[chatId] || 'Русский';
            const messageId = callbackQuery.message.message_id;
            if (userLanguage === 'English') {
                await seizureEnglish(bot, chatId, messageId);
            } else {
                await seizureRussian(bot, chatId, messageId);
            }
        } else if (data === 'info_about_disease') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            const messageId = callbackQuery.message.message_id;

            if (userLanguage === 'English') {
                await informationEnglish(bot, chatId, messageId);
            } else {
                await informationRussian(bot, chatId, messageId);
            }

        } else if (data === 'back_to_profile') {
            await bot.editMessageReplyMarkup({inline_keyboard: []}, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id
            });
            const userLanguage = userLanguages[chatId] || 'Русский';
            if (userLanguage === 'English') {
                await callbackMyProfileEnglish(bot, {chat: {id: chatId}});
            } else {
                await callbackMyProfileRussian(bot, {chat: {id: chatId}});
            }

        } else if (data === 'statistic') {
            const userLanguage = userLanguages[chatId] || 'Русский';
            const messageId = callbackQuery.message.message_id;

            if (userLanguage === 'English') {
                await statisticEnglish(bot, chatId, messageId);
            } else {
                await statisticRussian(bot, chatId, messageId);
            }


        } else if (data === 'reregistration') {

                // Check if user is a doctor
                const doctorResult = await db.query('SELECT * FROM doctors WHERE chat_id = $1', [chatId]);
                const isDoctor = doctorResult.rows.length > 0;

                if (isDoctor) {
                    // Delete doctor's data
                    await db.query('DELETE FROM doctors_messages WHERE doctor_id = $1', [chatId]);
                    await db.query('DELETE FROM messages WHERE doctor_key = (SELECT doctor_key FROM doctors WHERE chat_id = $1)', [chatId]);
                    await db.query('DELETE FROM doctors WHERE chat_id = $1', [chatId]);
                } else {
                    // Delete patient's data
                    await db.query('DELETE FROM notifications WHERE user_id = $1', [chatId]);
                    await db.query('DELETE FROM calendar WHERE user_id = $1', [chatId]);
                    await db.query('DELETE FROM messages WHERE user_id = $1', [chatId]);
                    await db.query('DELETE FROM bans WHERE user_id = $1', [chatId]);
                    await db.query('DELETE FROM users WHERE chat_id = $1', [chatId]);
                }
                await bot.deleteMessage(chatId, callbackQuery.message.message_id);
                // Restart registration process
                await handleStartCommand(bot, {chat: {id: chatId}});

        }


        else if (data === 'notifications') {
            const messageId = callbackQuery.message.message_id;
            const userResult = await db.query('SELECT language FROM users WHERE chat_id = $1', [chatId]);
            const userLanguage = userResult.rows[0].language;
            if (userLanguage === 'English') {
                //await notificationsEnglish.notificationsEnglish(chatId, messageId);
            } else if (userLanguage === 'Русский'){
                await notificationsRussian.handleNotifications(bot, callbackQuery.message.chat.id, messageId);
            }


        } else if (data === 'seizure_calendar') {
            const messageId = callbackQuery.message.message_id;
            const userLanguage = userLanguages[chatId] || 'Русский';

            if (userLanguage === 'English') {
                await seizureCalendarEnglish(bot, chatId, messageId);
            } else {
                await seizureCalendarRussian(bot, chatId, messageId);
            }

        } else if (data.startsWith('calendar_')) {
            const [_, day, monthOffset] = data.split('_');
            const userLanguage = userLanguages[chatId] || 'Русский';
            const messageId = callbackQuery.message.message_id;
            if (userLanguage === 'English') {
                await handleDayPressEnglish(bot, chatId, day, monthOffset, messageId);
            } else {
                await handleDayPressRussian(bot, chatId, day, monthOffset, messageId);
            }

        } else if (data.startsWith('change_month_')) {
            const monthOffset = parseInt(data.split('_')[2]);
            const userLanguage = userLanguages[chatId] || 'Русский';
            const messageId = callbackQuery.message.message_id;

            if (userLanguage === 'English') {
                await handleChangeMonthEnglish(bot, chatId, monthOffset, messageId);
            } else {
                await handleChangeMonthRussian(bot, chatId, monthOffset, messageId);
            }

            await bot.answerCallbackQuery(callbackQuery.id);

        } else if (data.startsWith('start_record_')) {
            const dateString = data.split('_')[2];
            const date = dateString;
            const messageId = callbackQuery.message.message_id;
            const userLanguage = userLanguages[chatId] || 'Русский';

            if (userLanguage === 'English') {
                await startRecordingEnglish(bot, chatId, date, messageId);
            } else {
                await startRecordingRussian(bot, chatId, date, messageId);
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

    bot.on('polling_error', (error) => {
        console.log('Polling error:', error);
    });
}).catch(err => {
    console.error('Error in callback handler:', err);
});