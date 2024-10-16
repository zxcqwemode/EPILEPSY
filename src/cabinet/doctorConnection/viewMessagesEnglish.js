const db = require('../../config/db');

// Обработчик для просмотра сообщений (английский)
module.exports = async function handleViewMessagesEnglish(bot, chatId) {
    const messages = await db.query('SELECT * FROM messages WHERE user_id = $1 ORDER BY message_date ASC', [chatId]);

    if (messages.rows.length > 0) {
        let messageText = "Message History:\n";
        messages.rows.forEach((msg) => {
            messageText += `(${msg.message_date}) ${msg.message_text}\n`;
        });

        await bot.sendMessage(chatId, messageText);
    } else {
        await bot.sendMessage(chatId, "You have no messages.");
    }
};
