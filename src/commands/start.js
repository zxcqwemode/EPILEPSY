const db = require('../config/db');
//const languageHandler = require('../handlers/languageHandler');

module.exports = async function handleStartCommand(bot, msg) {
    const chatId = msg.chat.id;

    try {
        const userCheck = await db.query('SELECT * FROM users WHERE chat_id = $1', [chatId]);
        const doctorCheck = await db.query('SELECT * FROM doctors WHERE chat_id = $1', [chatId]);

        // Если пользователь не существует, добавляем его в базу данных
        if (userCheck.rows.length === 0 && doctorCheck.rows.length === 0) {
            // Если пользователя нет, добавляем его в таблицу users
            await db.query('INSERT INTO users (chat_id, step) VALUES ($1, $2)', [chatId, 'language']);
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

        // Обработка выбора языка
        //bot.on('callback_query', (callbackQuery) => languageHandler(bot, callbackQuery));

    }
    catch (err) {
        console.error('Ошибка при обработке команды /start:', err);
    }
};
