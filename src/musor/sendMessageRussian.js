const db = require('../config/db');

// Обработчик для отправки сообщения врачу (русский)
module.exports = async function handleSendMessageRussian(bot, chatId) {
    await bot.sendMessage(chatId, "Напишите ваше сообщение:");

    // Обработчик текстового сообщения
    bot.once('message', async (msg) => {
        const messageText = msg.text;
        const user = await db.query('SELECT doctor_key FROM users WHERE chat_id = $1', [chatId]);

        if (user.rows.length > 0) {
            const doctorKey = user.rows[0].doctor_key;

            // Сохраняем сообщение в базе данных
            await db.query('INSERT INTO messages (user_id, doctor_key, message_text, message_date) VALUES ($1, $2, $3, NOW())', [chatId, doctorKey, messageText]);

            // Отправляем сообщение с подтверждением и кнопками
            const confirmationMessage = "Ваше сообщение отправлено.";
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Новое сообщение', callback_data: 'send_message' }],
                        [{ text: 'Вернуться', callback_data: 'back_to_profile' }],
                    ],
                },
            };

            await bot.sendMessage(chatId, confirmationMessage, options);
        } else {
            await bot.sendMessage(chatId, "Ошибка: ключ врача не найден.");
        }
    });
};
