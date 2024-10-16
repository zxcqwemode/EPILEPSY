const db = require('../../config/db');

// Обработчик для отправки сообщения врачу (английский)
module.exports = async function handleSendMessageEnglish(bot, chatId) {
    await bot.sendMessage(chatId, "Please write your message:");

    bot.once('message', async (msg) => {
        const messageText = msg.text;
        const user = await db.query('SELECT doctor_key FROM users WHERE chat_id = $1', [chatId]);
        const doctorKey = user.rows[0].doctor_key;

        await db.query('INSERT INTO messages (user_id, doctor_key, message_text, message_date) VALUES ($1, $2, $3, NOW())', [chatId, doctorKey, messageText]);
        await bot.sendMessage(chatId, "Your message has been sent.");
    });
};
