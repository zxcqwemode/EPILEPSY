const db = require('../config/db');

module.exports = async function handleStartCommand(bot, msg) {
    const chatId = msg.chat.id;

    try {
        const userCheck = await db.query('SELECT * FROM users WHERE chat_id = $1', [chatId]);

        if (userCheck.rows.length === 0) {
            await db.query('INSERT INTO users (chat_id, step) VALUES ($1, $2)', [chatId, 'role']);
            console.log(`Пользователь с chat_id: ${chatId} добавлен в базу данных.`);
        } else {
            console.log(`Пользователь с chat_id: ${chatId} уже существует в базе данных.`);
        }

        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Врач', callback_data: 'role_doctor' },
                        { text: 'Пациент', callback_data: 'role_patient' },
                    ],
                ],
            },
        };
        bot.sendMessage(chatId, 'Добро пожаловать! Выберите свою роль:', options);
    } catch (err) {
        console.error('Ошибка при обработке команды /start:', err);
    }
};
