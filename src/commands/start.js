const db = require('../config/db');

module.exports = async function handleStartCommand(bot, msg) {
    const chatId = msg.chat.id;

    try {
        // Проверка наличия таблиц users и doctors
        console.log("Проверяем наличие таблицы 'users'");
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

        const usersTableExists = await db.query(checkUsersTable);
        const doctorsTableExists = await db.query(checkDoctorsTable);

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
                    notification_text VARCHAR(50)
                );
            `;
            try {
                await db.query(createUsersTable);
                console.log("Таблица 'users' была создана.");
            } catch (error) {
                console.error("Ошибка при создании таблицы 'users':", error);
            }
        }

        if (!doctorsTableExists.rows[0].exists) {
            const createDoctorsTable = `
                CREATE TABLE doctors (
                    chat_id BIGINT PRIMARY KEY,
                    language VARCHAR(50)
                );
            `;
            try {
                await db.query(createDoctorsTable);
                console.log("Таблица 'doctors' была создана.");
            } catch (error) {
                console.error("Ошибка при создании таблицы 'doctors':", error);
            }
        }

        // Проверяем, существует ли пользователь
        const userCheck = await db.query('SELECT * FROM users WHERE chat_id = $1', [chatId]);
        const doctorCheck = await db.query('SELECT * FROM doctors WHERE chat_id = $1', [chatId]);

        // Если пользователь не существует, добавляем его в базу данных
        if (userCheck.rows.length === 0 && doctorCheck.rows.length === 0) {
            await db.query('INSERT INTO users (chat_id, step) VALUES ($1, $2)', [chatId, 'language_choice']);
            console.log(`Пользователь с chat_id: ${chatId} добавлен в базу данных.`);
        } else {
            console.log(`Пользователь с chat_id: ${chatId} уже существует в базе данных.`);
        }

        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Русский', callback_data: 'language_russian' },
                        { text: 'English', callback_data: 'language_english' },
                    ],
                ],
            },
        };

        // Спрашиваем язык
        await bot.sendMessage(chatId, 'Привет, я Эпилепсибот!\n' +
            'Помогаю отслеживать, когда, как и от чего у вас приступы эпилепсии\n' +
            '\n' +
            'Врачи рекомендуют вести такой дневник каждый день. Благодаря моим данным доктор быстро выяснит настоящую причину приступов и подберет лечение, которое будет работать.\n' +
            '\n' +
            'Выберите язык, чтобы я мог рассказать больше\n' +
            '\n' +
            'Если вы уже общались с моей предыдущей версией — не волнуйтесь, я сохранил все данные', options);

    } catch (err) {
        console.error('Ошибка при обработке команды /start:', err);
    }
};
