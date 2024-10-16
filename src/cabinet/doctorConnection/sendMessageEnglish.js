const db = require('../../config/db');

// Обработчик для отправки сообщения врачу (английский)
module.exports = async function handleSendMessageEnglish(bot, chatId) {
    await bot.sendMessage(chatId, "Please write your message:");

    // Обработчик текстового сообщения
    bot.once('message', async (msg) => {
        const messageText = msg.text;
        const user = await db.query('SELECT doctor_key FROM users WHERE chat_id = $1', [chatId]);

        if (user.rows.length > 0) {
            const doctorKey = user.rows[0].doctor_key;

            // Сохраняем сообщение в базе данных
            await db.query('INSERT INTO messages (user_id, doctor_key, message_text, message_date) VALUES ($1, $2, $3, NOW())', [chatId, doctorKey, messageText]);

            // Отправляем сообщение с подтверждением и кнопками
            const confirmationMessage = "Your message has been sent.";
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'New message', callback_data: 'send_message' }],
                        [{ text: 'Back', callback_data: 'back_to_profile' }],
                    ],
                },
            };

            await bot.sendMessage(chatId, confirmationMessage, options);
        } else {
            await bot.sendMessage(chatId, "Error: Doctor key not found.");
        }
    });
};
